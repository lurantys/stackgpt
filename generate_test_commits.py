#!/usr/bin/env python3
import random
import subprocess
import datetime
import os

START = datetime.date(2026, 1, 1)
END = datetime.date.today()

current = START
total = 0
while current <= END:
    n = random.randint(0, 6)
    times = sorted(random.sample(range(24 * 60), n)) if n else []
    for minute in times:
        h, m = divmod(minute, 60)
        ts = datetime.datetime(current.year, current.month, current.day, h, m, 0).isoformat()
        env = {**os.environ, 'GIT_AUTHOR_DATE': ts, 'GIT_COMMITTER_DATE': ts}
        subprocess.run(
            ['git', 'commit', '--allow-empty', '-m', f'test commit {total + 1}'],
            env=env, check=True, capture_output=True,
        )
        total += 1
    current += datetime.timedelta(days=1)

print(f'Created {total} commits')
subprocess.run(['git', 'push'], check=True)
print('Pushed to origin')
