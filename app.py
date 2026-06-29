from __future__ import annotations

import bisect
import json
import mimetypes
from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"


@dataclass(frozen=True)
class Activity:
    id: str
    name: str
    start: str
    end: str
    weight: int
    start_minutes: int
    end_minutes: int


def parse_time(value: str) -> int:
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (AttributeError, ValueError) as exc:
        raise ValueError(f"Horario invalido: {value!r}") from exc

    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"Horario fora do intervalo: {value!r}")

    return hour * 60 + minute


def validate_activities(raw_activities: list[dict[str, Any]]) -> list[Activity]:
    if not raw_activities:
        raise ValueError("Cadastre ao menos uma atividade.")

    activities: list[Activity] = []
    seen_ids: set[str] = set()

    for index, raw in enumerate(raw_activities, start=1):
        activity_id = str(raw.get("id") or f"atividade-{index}")
        name = str(raw.get("name") or "").strip()
        start = str(raw.get("start") or "").strip()
        end = str(raw.get("end") or "").strip()

        if not name:
            raise ValueError(f"A atividade {index} esta sem nome.")
        if activity_id in seen_ids:
            raise ValueError(f"ID duplicado: {activity_id}")

        seen_ids.add(activity_id)
        start_minutes = parse_time(start)
        end_minutes = parse_time(end)

        if start_minutes >= end_minutes:
            raise ValueError(f"A atividade '{name}' precisa terminar depois de comecar.")

        try:
            weight = int(raw.get("weight"))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Peso invalido na atividade '{name}'.") from exc

        if weight < 0:
            raise ValueError(f"O peso da atividade '{name}' nao pode ser negativo.")

        activities.append(
            Activity(
                id=activity_id,
                name=name,
                start=start,
                end=end,
                weight=weight,
                start_minutes=start_minutes,
                end_minutes=end_minutes,
            )
        )

    return activities


def find_previous_compatible(sorted_activities: list[Activity]) -> list[int]:
    end_times = [activity.end_minutes for activity in sorted_activities]
    previous: list[int] = []

    for activity in sorted_activities:
        previous.append(bisect.bisect_right(end_times, activity.start_minutes) - 1)

    return previous


def weighted_interval_iterative(
    activities: list[Activity],
) -> tuple[int, list[Activity], list[dict[str, Any]], list[int]]:
    sorted_activities = sorted(activities, key=lambda item: (item.end_minutes, item.start_minutes))
    previous = find_previous_compatible(sorted_activities)
    count = len(sorted_activities)
    dp = [0] * (count + 1)
    table: list[dict[str, Any]] = []

    for i in range(1, count + 1):
        activity = sorted_activities[i - 1]
        include_value = activity.weight + dp[previous[i - 1] + 1]
        exclude_value = dp[i - 1]
        dp[i] = max(include_value, exclude_value)
        table.append(
            {
                "i": i,
                "activity": activity.name,
                "previousCompatible": previous[i - 1] + 1,
                "include": include_value,
                "exclude": exclude_value,
                "best": dp[i],
            }
        )

    selected: list[Activity] = []
    i = count
    while i > 0:
        activity = sorted_activities[i - 1]
        include_value = activity.weight + dp[previous[i - 1] + 1]
        exclude_value = dp[i - 1]
        if include_value >= exclude_value:
            selected.append(activity)
            i = previous[i - 1] + 1
        else:
            i -= 1

    selected.reverse()
    return dp[count], selected, table, previous


def weighted_interval_recursive(
    activities: list[Activity],
) -> tuple[int, list[Activity], list[dict[str, Any]]]:
    sorted_activities = sorted(activities, key=lambda item: (item.end_minutes, item.start_minutes))
    previous = find_previous_compatible(sorted_activities)
    memo: dict[int, int] = {-1: 0}
    trace: list[dict[str, Any]] = []

    def solve(index: int) -> int:
        if index in memo:
            return memo[index]

        activity = sorted_activities[index]
        include_value = activity.weight + solve(previous[index])
        exclude_value = solve(index - 1)
        memo[index] = max(include_value, exclude_value)
        trace.append(
            {
                "i": index + 1,
                "activity": activity.name,
                "previousCompatible": previous[index] + 1,
                "include": include_value,
                "exclude": exclude_value,
                "best": memo[index],
            }
        )
        return memo[index]

    best = solve(len(sorted_activities) - 1)
    selected: list[Activity] = []
    index = len(sorted_activities) - 1

    while index >= 0:
        activity = sorted_activities[index]
        include_value = activity.weight + memo.get(previous[index], solve(previous[index]))
        exclude_value = memo.get(index - 1, solve(index - 1))
        if include_value >= exclude_value:
            selected.append(activity)
            index = previous[index]
        else:
            index -= 1

    selected.reverse()
    trace.sort(key=lambda row: row["i"])
    return best, selected, trace


def optimize_schedule(raw_activities: list[dict[str, Any]]) -> dict[str, Any]:
    activities = validate_activities(raw_activities)
    sorted_activities = sorted(activities, key=lambda item: (item.end_minutes, item.start_minutes))
    iterative_total, iterative_selected, iterative_table, previous = weighted_interval_iterative(activities)
    recursive_total, recursive_selected, recursive_trace = weighted_interval_recursive(activities)

    return {
        "sortedActivities": [serialize_activity(activity) for activity in sorted_activities],
        "previousCompatible": [value + 1 for value in previous],
        "iterative": {
            "totalWeight": iterative_total,
            "selected": [serialize_activity(activity) for activity in iterative_selected],
            "dpTable": iterative_table,
        },
        "recursive": {
            "totalWeight": recursive_total,
            "selected": [serialize_activity(activity) for activity in recursive_selected],
            "trace": recursive_trace,
        },
        "sameResult": iterative_total == recursive_total,
    }


def serialize_activity(activity: Activity) -> dict[str, Any]:
    data = asdict(activity)
    data.pop("start_minutes")
    data.pop("end_minutes")
    return data


class ScheduleRequestHandler(BaseHTTPRequestHandler):
    server_version = "AgendaDP/1.0"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.serve_static_file(STATIC_DIR / "index.html")
            return

        safe_path = Path(unquote(path.lstrip("/")))
        requested = (STATIC_DIR / safe_path).resolve()
        if STATIC_DIR.resolve() not in requested.parents and requested != STATIC_DIR.resolve():
            self.send_error(403)
            return

        self.serve_static_file(requested)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/optimize":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            result = optimize_schedule(payload.get("activities", []))
        except ValueError as exc:
            self.send_json({"error": str(exc)}, status=400)
            return
        except json.JSONDecodeError:
            self.send_json({"error": "JSON invalido."}, status=400)
            return

        self.send_json(result)

    def serve_static_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        content = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), ScheduleRequestHandler)
    print(f"Servidor iniciado em http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
