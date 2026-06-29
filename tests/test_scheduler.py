import unittest

from app import optimize_schedule, parse_time


class SchedulerTests(unittest.TestCase):
    def test_parse_time(self):
        self.assertEqual(parse_time("00:00"), 0)
        self.assertEqual(parse_time("08:30"), 510)
        self.assertEqual(parse_time("23:59"), 1439)

    def test_weighted_interval_schedule_uses_dynamic_programming(self):
        result = optimize_schedule(
            [
                {"id": "a1", "name": "A", "start": "08:00", "end": "10:00", "weight": 8},
                {"id": "a2", "name": "B", "start": "09:00", "end": "11:00", "weight": 6},
                {"id": "a3", "name": "C", "start": "10:30", "end": "12:30", "weight": 10},
                {"id": "a4", "name": "D", "start": "12:30", "end": "13:30", "weight": 3},
                {"id": "a5", "name": "E", "start": "13:00", "end": "14:00", "weight": 4},
                {"id": "a6", "name": "F", "start": "14:00", "end": "16:00", "weight": 9},
            ]
        )

        selected_names = [activity["name"] for activity in result["iterative"]["selected"]]
        self.assertEqual(result["iterative"]["totalWeight"], 31)
        self.assertEqual(result["recursive"]["totalWeight"], 31)
        self.assertEqual(selected_names, ["A", "C", "E", "F"])
        self.assertTrue(result["sameResult"])

    def test_rejects_overlapping_invalid_time_range(self):
        with self.assertRaises(ValueError):
            optimize_schedule(
                [{"id": "a1", "name": "A", "start": "10:00", "end": "09:00", "weight": 1}]
            )


if __name__ == "__main__":
    unittest.main()
