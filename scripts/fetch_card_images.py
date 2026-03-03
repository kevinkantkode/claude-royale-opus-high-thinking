#!/usr/bin/env python3
"""
Fetch Clash Royale card images from deckshop.pro.
Saves to data/cards/{key}.png. Reports failures.

Usage:
  python3 scripts/fetch_card_images.py           # fetch all
  python3 scripts/fetch_card_images.py --urls   # print URLs only
"""
import sys
import urllib.request
from pathlib import Path

# Extracted from deckshop.pro HTML: card key -> deckshop image filename
CARD_KEY_TO_DECKSHOP_IMG = {
    "little-prince": "LittlePrince.png",
    "golden-knight": "GoldenKnight.png",
    "skeleton-king": "SkeletonKing.png",
    "mighty-miner": "MightyMiner.png",
    "archer-queen": "ArcherQueen.png",
    "goblinstein": "Goblinstein.png",
    "monk": "Monk.png",
    "boss-bandit": "BossBandit.png",
    "the-log": "Log.png",
    "miner": "Miner.png",
    "princess": "Princess.png",
    "ice-wizard": "IceWiz.png",
    "royal-ghost": "Ghost.png",
    "bandit": "Bandit.png",
    "fisherman": "Fisherman.png",
    "electro-wizard": "eWiz.png",
    "inferno-dragon": "InfernoD.png",
    "phoenix": "Phoenix.png",
    "magic-archer": "MagicArcher.png",
    "lumberjack": "Lumber.png",
    "night-witch": "NightWitch.png",
    "mother-witch": "MotherWitch.png",
    "ram-rider": "RamRider.png",
    "graveyard": "Graveyard.png",
    "goblin-machine": "GoblinMachine.png",
    "sparky": "Sparky.png",
    "spirit-empress": "SpiritEmpress.png",
    "mega-knight": "MegaKnight.png",
    "lava-hound": "Lava.png",
    "mirror": "Mirror.png",
    "barbarian-barrel": "BarbBarrel.png",
    "wall-breakers": "WallBreakers.png",
    "goblin-curse": "GoblinCurse.png",
    "rage": "Rage.png",
    "goblin-barrel": "Barrel.png",
    "guards": "Guards.png",
    "skeleton-army": "Skarmy.png",
    "vines": "Vines.png",
    "clone": "Clone.png",
    "tornado": "Tornado.png",
    "void": "Void.png",
    "baby-dragon": "BabyD.png",
    "dark-prince": "DarkPrince.png",
    "freeze": "Freeze.png",
    "poison": "Poison.png",
    "rune-giant": "RuneGiant.png",
    "hunter": "Hunter.png",
    "goblin-drill": "GoblinDrill.png",
    "witch": "Witch.png",
    "balloon": "Balloon.png",
    "prince": "Prince.png",
    "electro-dragon": "eDragon.png",
    "bowler": "Bowler.png",
    "executioner": "Exe.png",
    "cannon-cart": "CannonCart.png",
    "giant-skeleton": "GiantSkelly.png",
    "lightning": "Lightning.png",
    "goblin-giant": "GobGiant.png",
    "x-bow": "XBow.png",
    "pekka": "PEKKA.png",
    "electro-giant": "ElectroGiant.png",
    "golem": "Golem.png",
    "heal-spirit": "HealSpirit.png",
    "ice-golem": "IceGolem.png",
    "suspicious-bush": "SuspiciousBush.png",
    "tombstone": "Tombstone.png",
    "mega-minion": "MM.png",
    "dart-goblin": "DartGob.png",
    "earthquake": "Earthquake.png",
    "elixir-golem": "ElixirGolem.png",
    "fireball": "Fireball.png",
    "mini-pekka": "MP.png",
    "musketeer": "Musk.png",
    "goblin-cage": "GoblinCage.png",
    "goblin-hut": "GobHut.png",
    "valkyrie": "Valk.png",
    "battle-ram": "Ram.png",
    "bomb-tower": "BombTower.png",
    "flying-machine": "FlyingMachine.png",
    "hog-rider": "Hog.png",
    "battle-healer": "BattleHealer.png",
    "furnace": "Furnace.png",
    "zappies": "Zappies.png",
    "goblin-demolisher": "GoblinDemolisher.png",
    "giant": "Giant.png",
    "inferno-tower": "Inferno.png",
    "wizard": "Wiz.png",
    "royal-hogs": "RoyalHogs.png",
    "rocket": "Rocket.png",
    "barbarian-hut": "BarbHut.png",
    "elixir-collector": "Pump.png",
    "three-musketeers": "3M.png",
    "skeletons": "Skellies.png",
    "electro-spirit": "ElectroSpirit.png",
    "fire-spirit": "FireSpirit.png",
    "ice-spirit": "IceSpirit.png",
    "goblins": "Gobs.png",
    "spear-goblins": "SpearGobs.png",
    "bomber": "Bomber.png",
    "bats": "Bats.png",
    "zap": "Zap.png",
    "giant-snowball": "Snowball.png",
    "berserker": "Berserker.png",
    "archers": "Archers.png",
    "arrows": "Arrows.png",
    "knight": "Knight.png",
    "minions": "Minions.png",
    "cannon": "Cannon.png",
    "goblin-gang": "GobGang.png",
    "skeleton-barrel": "SkellyBarrel.png",
    "firecracker": "Firecracker.png",
    "royal-delivery": "RoyalDelivery.png",
    "skeleton-dragons": "SkeletonDragons.png",
    "mortar": "Mortar.png",
    "tesla": "Tesla.png",
    "barbarians": "Barbs.png",
    "minion-horde": "Horde.png",
    "rascals": "Rascals.png",
    "royal-giant": "RG.png",
    "elite-barbarians": "eBarbs.png",
    "royal-recruits": "RoyalRecruits.png",
}

BASE_URL = "https://www.deckshop.pro/img/card_ed"
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "data" / "cards"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.deckshop.pro/",
}


def main() -> None:
    urls_only = "--urls" in sys.argv or "-u" in sys.argv

    if urls_only:
        for key, filename in CARD_KEY_TO_DECKSHOP_IMG.items():
            print(f"https://www.deckshop.pro/img/card_ed/{filename}")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failed: list[tuple[str, str]] = []

    for key, filename in CARD_KEY_TO_DECKSHOP_IMG.items():
        url = f"{BASE_URL}/{filename}"
        out_path = OUTPUT_DIR / f"{key}.png"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
        except urllib.error.HTTPError as e:
            failed.append((key, f"HTTP {e.code}"))
            print(f"FAIL {key}: HTTP {e.code}")
            continue
        except Exception as e:
            failed.append((key, str(e)))
            print(f"FAIL {key}: {e}")
            continue

        if data[:8] == b"\x89PNG\r\n\x1a\n":
            out_path.write_bytes(data)
            print(f"OK  {key}")
        elif b"<html" in data.lower() or b"cloudflare" in data.lower():
            failed.append((key, "403 (Cloudflare block)"))
            print(f"FAIL {key}: 403 (Cloudflare block)")
        else:
            out_path.write_bytes(data)
            print(f"OK  {key}")

    if failed:
        print(f"\n--- FAILED ({len(failed)} / {len(CARD_KEY_TO_DECKSHOP_IMG)}) ---")
        for k, r in failed:
            print(f"  {k}: {r}")
    else:
        print(f"\nAll {len(CARD_KEY_TO_DECKSHOP_IMG)} fetched.")


if __name__ == "__main__":
    main()
