#!/usr/bin/env python3
"""
Clean and rename card images in data/cards_png.
- Strips (1), (2) suffix from filenames
- Renames all files to {card_key}.png in each folder (base_card, hero_card, evo_card)

Usage:
  python3 scripts/clean_card_images.py
"""
import re
from pathlib import Path

# deckshop filename (no .png) -> card key (from fetch_card_images.py, reversed)
DECKSHOP_TO_KEY = {
    "LittlePrince": "little-prince",
    "GoldenKnight": "golden-knight",
    "SkeletonKing": "skeleton-king",
    "MightyMiner": "mighty-miner",
    "ArcherQueen": "archer-queen",
    "Goblinstein": "goblinstein",
    "Monk": "monk",
    "BossBandit": "boss-bandit",
    "Log": "the-log",
    "Miner": "miner",
    "Princess": "princess",
    "IceWiz": "ice-wizard",
    "Ghost": "royal-ghost",
    "Bandit": "bandit",
    "Fisherman": "fisherman",
    "eWiz": "electro-wizard",
    "InfernoD": "inferno-dragon",
    "Phoenix": "phoenix",
    "MagicArcher": "magic-archer",
    "Lumber": "lumberjack",
    "NightWitch": "night-witch",
    "MotherWitch": "mother-witch",
    "RamRider": "ram-rider",
    "Graveyard": "graveyard",
    "GoblinMachine": "goblin-machine",
    "Sparky": "sparky",
    "SpiritEmpress": "spirit-empress",
    "MegaKnight": "mega-knight",
    "Lava": "lava-hound",
    "Mirror": "mirror",
    "BarbBarrel": "barbarian-barrel",
    "WallBreakers": "wall-breakers",
    "GoblinCurse": "goblin-curse",
    "Rage": "rage",
    "Barrel": "goblin-barrel",
    "Guards": "guards",
    "Skarmy": "skeleton-army",
    "Vines": "vines",
    "Clone": "clone",
    "Tornado": "tornado",
    "Void": "void",
    "BabyD": "baby-dragon",
    "DarkPrince": "dark-prince",
    "Freeze": "freeze",
    "Poison": "poison",
    "RuneGiant": "rune-giant",
    "Hunter": "hunter",
    "GoblinDrill": "goblin-drill",
    "Witch": "witch",
    "Balloon": "balloon",
    "Prince": "prince",
    "eDragon": "electro-dragon",
    "Bowler": "bowler",
    "Exe": "executioner",
    "CannonCart": "cannon-cart",
    "GiantSkelly": "giant-skeleton",
    "Lightning": "lightning",
    "GobGiant": "goblin-giant",
    "XBow": "x-bow",
    "PEKKA": "pekka",
    "ElectroGiant": "electro-giant",
    "Golem": "golem",
    "HealSpirit": "heal-spirit",
    "IceGolem": "ice-golem",
    "SuspiciousBush": "suspicious-bush",
    "Tombstone": "tombstone",
    "MM": "mega-minion",
    "DartGob": "dart-goblin",
    "Earthquake": "earthquake",
    "ElixirGolem": "elixir-golem",
    "Fireball": "fireball",
    "MP": "mini-pekka",
    "Musk": "musketeer",
    "GoblinCage": "goblin-cage",
    "GobHut": "goblin-hut",
    "Valk": "valkyrie",
    "Ram": "battle-ram",
    "BombTower": "bomb-tower",
    "FlyingMachine": "flying-machine",
    "Hog": "hog-rider",
    "BattleHealer": "battle-healer",
    "Furnace": "furnace",
    "Zappies": "zappies",
    "GoblinDemolisher": "goblin-demolisher",
    "Giant": "giant",
    "Inferno": "inferno-tower",
    "Wiz": "wizard",
    "RoyalHogs": "royal-hogs",
    "Rocket": "rocket",
    "BarbHut": "barbarian-hut",
    "Pump": "elixir-collector",
    "3M": "three-musketeers",
    "Skellies": "skeletons",
    "ElectroSpirit": "electro-spirit",
    "FireSpirit": "fire-spirit",
    "IceSpirit": "ice-spirit",
    "Gobs": "goblins",
    "SpearGobs": "spear-goblins",
    "Bomber": "bomber",
    "Bats": "bats",
    "Zap": "zap",
    "Snowball": "giant-snowball",
    "Berserker": "berserker",
    "Archers": "archers",
    "Arrows": "arrows",
    "Knight": "knight",
    "Minions": "minions",
    "Cannon": "cannon",
    "GobGang": "goblin-gang",
    "SkellyBarrel": "skeleton-barrel",
    "Firecracker": "firecracker",
    "RoyalDelivery": "royal-delivery",
    "SkeletonDragons": "skeleton-dragons",
    "Mortar": "mortar",
    "Tesla": "tesla",
    "Barbs": "barbarians",
    "Horde": "minion-horde",
    "Rascals": "rascals",
    "RG": "royal-giant",
    "eBarbs": "elite-barbarians",
    "RoyalRecruits": "royal-recruits",
}

SUFFIX_RE = re.compile(r" \(\d+\)(?=\.png$)", re.IGNORECASE)

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CARDS_PNG = REPO_ROOT / "data" / "cards_png"


def strip_suffix(name: str) -> str:
    """Remove ' (1)', ' (2)' etc from filename."""
    return SUFFIX_RE.sub("", name)


def main() -> None:
    for subdir in ["base_card", "hero_card", "evo_card"]:
        folder = CARDS_PNG / subdir
        if not folder.exists():
            continue

        # Group files by base name (without (1) suffix)
        by_base: dict[str, list[Path]] = {}
        for f in folder.iterdir():
            if not f.is_file() or f.suffix.lower() != ".png":
                continue
            base = strip_suffix(f.name)
            by_base.setdefault(base, []).append(f)

        for base_name, files in by_base.items():
            # Prefer file without suffix; otherwise use first
            files.sort(key=lambda p: (p.name != base_name, p.name))
            keep = files[0]
            for dup in files[1:]:
                dup.unlink()
                print(f"  removed duplicate: {subdir}/{dup.name}")
            if keep.name != base_name:
                new_path = keep.parent / base_name
                keep.rename(new_path)
                keep = new_path

            # Rename to card key
            stem = keep.stem
            if stem in DECKSHOP_TO_KEY:
                key = DECKSHOP_TO_KEY[stem]
                dest = keep.parent / f"{key}.png"
                if keep != dest:
                    keep.rename(dest)
                    print(f"  renamed: {subdir}/{stem}.png -> {key}.png")
            else:
                print(f"  skip (no mapping): {subdir}/{keep.name}")

    print("Done.")


if __name__ == "__main__":
    main()
