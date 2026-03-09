#!/usr/bin/env python3
"""
Fetch Clash Royale card data. Uses embedded list (hardcoded).
Run: python3 scripts/fetch_cards_deckshop.py
Outputs: data/cards.json
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_PATH = DATA_DIR / "cards.json"

# Hero/champion ability costs (not on Deck Shop)
HERO_ABILITY_COSTS = {
    "knight": 2, "giant": 2, "mini-pekka": 1, "musketeer": 3, "mega-minion": 2,
    "goblins": 1, "wizard": 1, "ice-golem": 2, "barbarian-barrel": 1, "magic-archer": 1,
}
CHAMPION_ABILITY_COSTS = {
    "archer-queen": 1, "golden-knight": 1, "monk": 1, "skeleton-king": 2,
    "mighty-miner": 1, "little-prince": 3, "boss-bandit": 1, "goblinstein": 2,
}

# Embedded card list (121 cards)
DECKSHOP_CARDS = [
    ("skeletons", "Skeletons", 1, "Troop"), ("electro-spirit", "Electro Spirit", 1, "Troop"),
    ("fire-spirit", "Fire Spirit", 1, "Troop"), ("ice-spirit", "Ice Spirit", 1, "Troop"),
    ("heal-spirit", "Heal Spirit", 1, "Troop"), ("mirror", "Mirror", 1, "Spell"),
    ("goblins", "Goblins", 2, "Troop"), ("spear-goblins", "Spear Goblins", 2, "Troop"),
    ("bomber", "Bomber", 2, "Troop"), ("bats", "Bats", 2, "Troop"), ("zap", "Zap", 2, "Spell"),
    ("giant-snowball", "Giant Snowball", 2, "Spell"), ("berserker", "Berserker", 2, "Troop"),
    ("ice-golem", "Ice Golem", 2, "Troop"), ("suspicious-bush", "Suspicious Bush", 2, "Troop"),
    ("barbarian-barrel", "Barbarian Barrel", 2, "Spell"), ("wall-breakers", "Wall Breakers", 2, "Troop"),
    ("goblin-curse", "Goblin Curse", 2, "Spell"), ("rage", "Rage", 2, "Spell"),
    ("the-log", "The Log", 2, "Spell"),
    ("archers", "Archers", 3, "Troop"), ("arrows", "Arrows", 3, "Spell"),
    ("knight", "Knight", 3, "Troop"), ("minions", "Minions", 3, "Troop"),
    ("cannon", "Cannon", 3, "Building"), ("goblin-gang", "Goblin Gang", 3, "Troop"),
    ("skeleton-barrel", "Skeleton Barrel", 3, "Troop"), ("firecracker", "Firecracker", 3, "Troop"),
    ("royal-delivery", "Royal Delivery", 3, "Spell"), ("tombstone", "Tombstone", 3, "Building"),
    ("mega-minion", "Mega Minion", 3, "Troop"), ("dart-goblin", "Dart Goblin", 3, "Troop"),
    ("earthquake", "Earthquake", 3, "Spell"), ("elixir-golem", "Elixir Golem", 3, "Troop"),
    ("goblin-barrel", "Goblin Barrel", 3, "Spell"), ("guards", "Guards", 3, "Troop"),
    ("skeleton-army", "Skeleton Army", 3, "Troop"), ("vines", "Vines", 3, "Spell"),
    ("clone", "Clone", 3, "Spell"), ("tornado", "Tornado", 3, "Spell"), ("void", "Void", 3, "Spell"),
    ("miner", "Miner", 3, "Troop"), ("princess", "Princess", 3, "Troop"),
    ("ice-wizard", "Ice Wizard", 3, "Troop"), ("royal-ghost", "Royal Ghost", 3, "Troop"),
    ("bandit", "Bandit", 3, "Troop"), ("fisherman", "Fisherman", 3, "Troop"),
    ("little-prince", "Little Prince", 3, "Troop"),
    ("skeleton-dragons", "Skeleton Dragons", 4, "Troop"), ("mortar", "Mortar", 4, "Building"),
    ("tesla", "Tesla", 4, "Building"), ("fireball", "Fireball", 4, "Spell"),
    ("mini-pekka", "Mini P.E.K.K.A", 4, "Troop"), ("musketeer", "Musketeer", 4, "Troop"),
    ("goblin-cage", "Goblin Cage", 4, "Building"), ("goblin-hut", "Goblin Hut", 4, "Building"),
    ("valkyrie", "Valkyrie", 4, "Troop"), ("battle-ram", "Battle Ram", 4, "Troop"),
    ("bomb-tower", "Bomb Tower", 4, "Building"), ("flying-machine", "Flying Machine", 4, "Troop"),
    ("hog-rider", "Hog Rider", 4, "Troop"), ("battle-healer", "Battle Healer", 4, "Troop"),
    ("furnace", "Furnace", 4, "Troop"), ("zappies", "Zappies", 4, "Troop"),
    ("goblin-demolisher", "Goblin Demolisher", 4, "Troop"), ("baby-dragon", "Baby Dragon", 4, "Troop"),
    ("dark-prince", "Dark Prince", 4, "Troop"), ("freeze", "Freeze", 4, "Spell"),
    ("poison", "Poison", 4, "Spell"), ("rune-giant", "Rune Giant", 4, "Troop"),
    ("hunter", "Hunter", 4, "Troop"), ("goblin-drill", "Goblin Drill", 4, "Building"),
    ("electro-wizard", "Electro Wizard", 4, "Troop"), ("inferno-dragon", "Inferno Dragon", 4, "Troop"),
    ("phoenix", "Phoenix", 4, "Troop"), ("magic-archer", "Magic Archer", 4, "Troop"),
    ("lumberjack", "Lumberjack", 4, "Troop"), ("night-witch", "Night Witch", 4, "Troop"),
    ("mother-witch", "Mother Witch", 4, "Troop"), ("golden-knight", "Golden Knight", 4, "Troop"),
    ("skeleton-king", "Skeleton King", 4, "Troop"), ("mighty-miner", "Mighty Miner", 4, "Troop"),
    ("barbarians", "Barbarians", 5, "Troop"), ("minion-horde", "Minion Horde", 5, "Troop"),
    ("rascals", "Rascals", 5, "Troop"), ("giant", "Giant", 5, "Troop"),
    ("inferno-tower", "Inferno Tower", 5, "Building"), ("wizard", "Wizard", 5, "Troop"),
    ("royal-hogs", "Royal Hogs", 5, "Troop"), ("witch", "Witch", 5, "Troop"),
    ("balloon", "Balloon", 5, "Troop"), ("prince", "Prince", 5, "Troop"),
    ("electro-dragon", "Electro Dragon", 5, "Troop"), ("bowler", "Bowler", 5, "Troop"),
    ("executioner", "Executioner", 5, "Troop"), ("cannon-cart", "Cannon Cart", 5, "Troop"),
    ("ram-rider", "Ram Rider", 5, "Troop"), ("graveyard", "Graveyard", 5, "Spell"),
    ("goblin-machine", "Goblin Machine", 5, "Troop"), ("archer-queen", "Archer Queen", 5, "Troop"),
    ("goblinstein", "Goblinstein", 5, "Troop"), ("monk", "Monk", 5, "Troop"),
    ("royal-giant", "Royal Giant", 6, "Troop"), ("elite-barbarians", "Elite Barbarians", 6, "Troop"),
    ("rocket", "Rocket", 6, "Spell"), ("barbarian-hut", "Barbarian Hut", 6, "Building"),
    ("elixir-collector", "Elixir Collector", 6, "Building"),
    ("giant-skeleton", "Giant Skeleton", 6, "Troop"), ("lightning", "Lightning", 6, "Spell"),
    ("goblin-giant", "Goblin Giant", 6, "Troop"), ("x-bow", "X-Bow", 6, "Building"),
    ("sparky", "Sparky", 6, "Troop"), ("spirit-empress", "Spirit Empress", 6, "Troop"),
    ("boss-bandit", "Boss Bandit", 6, "Troop"),
    ("royal-recruits", "Royal Recruits", 7, "Troop"), ("pekka", "P.E.K.K.A", 7, "Troop"),
    ("electro-giant", "Electro Giant", 7, "Troop"), ("mega-knight", "Mega Knight", 7, "Troop"),
    ("lava-hound", "Lava Hound", 7, "Troop"),
    ("golem", "Golem", 8, "Troop"),
    ("three-musketeers", "Three Musketeers", 9, "Troop"),
]


def build_cards(card_list):
    """Build card list with ability_cost and is_mirror."""
    cards = []
    for key, name, elixir, ctype in card_list:
        card = {"key": key, "name": name, "elixir": elixir, "type": ctype}
        if key == "mirror":
            card["is_mirror"] = True
        ability_cost = HERO_ABILITY_COSTS.get(key) or CHAMPION_ABILITY_COSTS.get(key)
        if ability_cost is not None:
            card["ability_cost"] = ability_cost
        cards.append(card)
    return sorted(cards, key=lambda c: (c["elixir"], c["name"]))


def main():
    cards = build_cards(DECKSHOP_CARDS)
    print(f"Generated {len(cards)} cards from embedded list")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(cards, f, indent=2)
    print(f"Wrote {len(cards)} cards to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
