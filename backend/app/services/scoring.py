"""Оцінка якості коду (0–100): від 100 віднімаються штрафи за зауваження залежно від серйозності.
Формула збігається з тією, що використовує фронтенд (frontend/src/utils/score.js)."""

PENALTY = {"critical": 18, "high": 10, "medium": 5, "low": 2, "info": 0.5}


def quality_score(severities: list[str]) -> int:
    penalty = sum(PENALTY.get(s, 0) for s in severities)
    return max(0, round(100 - penalty))
