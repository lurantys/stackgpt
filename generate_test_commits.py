#!/usr/bin/env python3
import random
import subprocess
import datetime

BRANCH = 'test-activity'
START = datetime.date(2026, 1, 1)
END = datetime.date.today()

subprocess.run(['git', 'checkout', '-b', BRANCH], check=True)

current = START
total = 0
while current <= END:
    n = random.randint(0, 6)
    times = sorted(random.sample(range(24 * 60), n)) if n else []
    for minute in times:
        h, m = divmod(minute, 60)
        ts = datetime.datetime(current.year, current.month, current.day, h, m, 0).isoformat()
        env = {'GIT_AUTHOR_DATE': ts, 'GIT_COMMITTER_DATE': ts}
        subprocess.run(
            ['git', 'commit', '--allow-empty', '-m', f'test commit {total + 1}'],
            env={**__import__('os').environ, **env},
            check=True, capture_output=True,
        )
        total += 1
    current += datetime.timedelta(days=1)

print(f'Created {total} commits on branch {BRANCH}')
subprocess.run(['git', 'push', '-u', 'origin', BRANCH], check=True)
print(f'Pushed branch {BRANCH} to origin')
