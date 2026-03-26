"""
Nudge message templates and selection logic.

Templates are organised by priority (0-3) and escalation tier (early/mid/late).
The worker selects a random template after determining the tier from the
attempt-to-max-attempts ratio.
"""

import random

# ── Escalation tiers ─────────────────────────────────────────────────────

EARLY = "early"
MID = "mid"
LATE = "late"


def get_escalation_tier(attempt: int, max_attempts: int) -> str:
    """Return escalation tier based on attempt progress through max_attempts."""
    ratio = attempt / max_attempts
    if ratio <= 0.33:
        return EARLY
    if ratio <= 0.66:
        return MID
    return LATE


# ── Task nudge templates ─────────────────────────────────────────────────
# {task_title} is interpolated via str.format().

TASK_NUDGE_TEMPLATES: dict[int, dict[str, list[str]]] = {
    # Priority 0 — NONE
    0: {
        EARLY: [
            "{task_title} is on your list. Technically.",
            "No pressure, but {task_title} is still there.",
            "Heads up: {task_title} is hanging around.",
            "Nobody's watching, but {task_title} is still on the list.",
        ],
        MID: [
            "{task_title} is starting to collect dust.",
            "Still there. Still waiting. No rush: {task_title}",
            "{task_title} is quietly judging you. Just a little.",
            "{task_title} isn't going anywhere. Might as well, right?",
        ],
        LATE: [
            "Last call for {task_title}. Or not. Honestly, it's fine.",
            "{task_title} has been very patient with you.",
            "If {task_title} had feelings, they'd be mildly hurt by now.",
            "Your future self whispered something about {task_title}. Just saying.",
        ],
    },
    # Priority 1 — LOW
    1: {
        EARLY: [
            "{task_title} — your future self will thank you.",
            "Quick reminder about {task_title}. You'll feel better after.",
            "Hey, {task_title} is waiting. Guilt-free if you do it now.",
        ],
        MID: [
            "Your future self is starting to side-eye you about {task_title}.",
            "{task_title} — the guilt is starting to simmer.",
            "Still there. Still waiting. No rush (okay, a little rush): {task_title}",
        ],
        LATE: [
            "{task_title} — you'll feel guilty if you don't. You know this.",
            "That nagging feeling? It's {task_title}. Handle it.",
            "Your future self will thank you. Or at least stop side-eyeing you. Do {task_title}.",
        ],
    },
    # Priority 2 — MEDIUM
    2: {
        EARLY: [
            "{task_title} — someone might notice if you don't.",
            "People may or may not be watching. {task_title} is due.",
            "Just a friendly nudge: {task_title}. Others might be paying attention.",
        ],
        MID: [
            "{task_title} — eyes are on you. No big deal. Okay, a little big deal.",
            "Others are noticing. {task_title} is still on your plate.",
            "{task_title} — you've got an audience. Time to perform.",
        ],
        LATE: [
            "People are definitely watching now. {task_title} needs your attention.",
            "{task_title} — the spotlight is on and you're still backstage.",
            "This one's been staring at you for a while — ready to knock it out? {task_title}",
        ],
    },
    # Priority 3 — HIGH
    3: {
        EARLY: [
            "{task_title} — someone's counting on you.",
            "People are depending on you for {task_title}. You've got this.",
            "This one hits different: {task_title}. The stakes are personal.",
            "{task_title} — this is between you and you.",
        ],
        MID: [
            "{task_title} — people are counting on you. Don't leave them hanging.",
            "{task_title} — you know this matters to you. Don't put it off.",
            "You set this bar for yourself: {task_title}. Time to clear it.",
            "{task_title} — your future self is watching. Make them proud.",
        ],
        LATE: [
            "{task_title} — they're counting on you and time is running out.",
            "Real talk: people will be let down if {task_title} doesn't happen.",
            "{task_title} — you owe it to yourself. No more excuses. Go.",
            "{task_title} — this is the one you can't blame on anyone else.",
        ],
    },
}


# ── Title templates ──────────────────────────────────────────────────────

NUDGE_TITLES: dict[int, list[str]] = {
    0: ["Hey", "Psst", "Oh right...", "FYI"],
    1: ["Reminder", "Don't forget", "Quick nudge"],
    2: ["Heads up!", "Eyes on you", "Nudge!"],
    3: ["This matters", "Don't forget!", "Important"],
}


# ── List nudge templates ─────────────────────────────────────────────────
# {list_name}, {count}, {due_today_count} interpolated via str.format().
# "due_today" variants are used when due_today_count > 0.

LIST_NUDGE_TEMPLATES: dict[str, list[str]] = {
    EARLY: [
        "{list_name} has {count} item(s) waiting for you.",
        "Your {list_name} list isn't going to check itself off. {count} to go.",
        "{count} thing(s) in {list_name}. Just letting you know.",
    ],
    MID: [
        "{list_name} still has {count} item(s). They're getting restless.",
        "Your {list_name} list is giving you the look. {count} to go.",
        "{count} item(s) left in {list_name}. Tick tock.",
    ],
    LATE: [
        "{list_name}: {count} item(s) remain. This is getting serious.",
        "Last nudge territory for {list_name}. {count} still pending.",
        "{list_name} has been very patient. {count} item(s) to go.",
    ],
}

LIST_DUE_TODAY_TEMPLATES: dict[str, list[str]] = {
    EARLY: [
        "{due_today_count} task(s) due today in {list_name}. You've got time.",
        "{list_name}: {due_today_count} due today. Easy day.",
        "Today's lineup from {list_name}: {due_today_count} task(s).",
    ],
    MID: [
        "{due_today_count} task(s) due today in {list_name}. Clock's ticking.",
        "{list_name} has {due_today_count} thing(s) due today. Just saying.",
        "Today isn't over yet: {due_today_count} left in {list_name}.",
    ],
    LATE: [
        "{due_today_count} task(s) due TODAY in {list_name}. Time to move.",
        "{list_name}: {due_today_count} due today and the day isn't getting longer.",
        "Final nudge: {due_today_count} task(s) due today in {list_name}.",
    ],
}

LIST_TITLES: list[str] = ["List check-in", "Your list", "Nudge!"]


# ── Habit nudge templates ───────────────────────────────────────────────
# {habit_name} and {streak_count} interpolated via str.format().

HABIT_NUDGE_TEMPLATES: dict[str, list[str]] = {
    EARLY: [
        "Time for {habit_name}. You've got this.",
        "{habit_name} — small steps, big results.",
        "Friendly reminder: {habit_name} is on your plate today.",
    ],
    MID: [
        "{habit_name} is still waiting for you today.",
        "Don't break the chain — {habit_name} needs your attention.",
        "Still time for {habit_name}. Your future self will thank you.",
    ],
    LATE: [
        "Last chance today for {habit_name}. Make it count.",
        "{habit_name} — the day's almost over. Don't let it slip.",
        "You'll regret skipping {habit_name} tomorrow. Go do it now.",
    ],
}

HABIT_STREAK_TEMPLATES: dict[str, list[str]] = {
    EARLY: [
        "{habit_name} — {streak_count} day streak! Keep it alive.",
        "{streak_count} days strong on {habit_name}. Let's make it {next_streak}.",
        "Day {next_streak} of {habit_name}? Only if you show up.",
    ],
    MID: [
        "Your {streak_count} day streak on {habit_name} is on the line.",
        "{habit_name}: {streak_count} days and counting. Don't stop now.",
        "{streak_count} days of {habit_name}. Today makes {next_streak}.",
    ],
    LATE: [
        "{streak_count} day streak on {habit_name}. Don't blow it now.",
        "You've done {habit_name} for {streak_count} days straight. Don't quit today.",
        "Last nudge: {habit_name}. {streak_count} day streak is at stake.",
    ],
}

HABIT_TITLES: list[str] = ["Habit time", "Stay consistent", "Daily habit"]


# ── Selection functions ──────────────────────────────────────────────────


def select_task_nudge(
    priority: int,
    attempt: int,
    max_attempts: int,
    task_title: str,
    stack_count: int = 0,
) -> tuple[str, str]:
    """Return (title, body) for a task nudge notification."""
    tier = get_escalation_tier(attempt, max_attempts)
    # Stacked recurring tasks escalate faster.
    if stack_count >= 2:
        tier = LATE
    elif stack_count >= 1 and tier == EARLY:
        tier = MID
    templates = TASK_NUDGE_TEMPLATES[priority][tier]
    body = random.choice(templates).format(task_title=task_title)
    if stack_count > 0:
        body += f" (x{stack_count + 1})"
    title = random.choice(NUDGE_TITLES[priority])
    return title, body


def select_list_nudge(
    attempt: int,
    max_attempts: int,
    list_name: str,
    pending_count: int,
    due_today_count: int,
) -> tuple[str, str]:
    """Return (title, body) for a list nudge notification."""
    tier = get_escalation_tier(attempt, max_attempts)
    if due_today_count > 0:
        templates = LIST_DUE_TODAY_TEMPLATES[tier]
        body = random.choice(templates).format(
            list_name=list_name,
            count=pending_count,
            due_today_count=due_today_count,
        )
    else:
        templates = LIST_NUDGE_TEMPLATES[tier]
        body = random.choice(templates).format(
            list_name=list_name,
            count=pending_count,
        )
    title = random.choice(LIST_TITLES)
    return title, body


# ── Standalone reminder templates ────────────────────────────────────────
# {reminder_name} interpolated via str.format().

STANDALONE_REMINDER_TEMPLATES: list[str] = [
    "Reminder: {reminder_name}",
    "Don't forget: {reminder_name}",
    "Heads up — {reminder_name}",
    "Time for: {reminder_name}",
    "Hey, it's time: {reminder_name}",
]

STANDALONE_REMINDER_TITLES: list[str] = [
    "Reminder",
    "Heads up",
    "Don't forget",
]


def select_standalone_reminder_nudge(reminder_name: str) -> tuple[str, str]:
    """Return (title, body) for a standalone reminder notification."""
    title = random.choice(STANDALONE_REMINDER_TITLES)
    body = random.choice(STANDALONE_REMINDER_TEMPLATES).format(
        reminder_name=reminder_name
    )
    return title, body


def select_habit_nudge(
    attempt: int,
    max_attempts: int,
    habit_name: str,
    streak_count: int = 0,
) -> tuple[str, str]:
    """Return (title, body) for a habit nudge notification."""
    tier = get_escalation_tier(attempt, max_attempts)
    if streak_count > 0:
        templates = HABIT_STREAK_TEMPLATES[tier]
        body = random.choice(templates).format(
            habit_name=habit_name,
            streak_count=streak_count,
            next_streak=streak_count + 1,
        )
    else:
        templates = HABIT_NUDGE_TEMPLATES[tier]
        body = random.choice(templates).format(habit_name=habit_name)
    title = random.choice(HABIT_TITLES)
    return title, body
