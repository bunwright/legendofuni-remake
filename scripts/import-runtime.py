#!/usr/bin/env python3
"""Import the original game's user-supplied runtime data and safe media only.
Never runs or copies EXE/DLL files or bundled installers.
Usage: python3 scripts/import-runtime.py ~/Downloads/lou_game
Requires ffmpeg for BMP/PNG and WMA/MP3 conversion.
"""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads/lou_game'
project = Path(__file__).resolve().parents[1]
media = project / 'public/assets/legacy'
media.mkdir(parents=True, exist_ok=True)


def parse(name):
    sections = {}
    current = None
    for line in (root / 'data' / name).read_bytes().decode('gb18030').splitlines():
        line = line.strip()
        if not line or line.startswith('//') or line.startswith(';'):
            continue
        if line.startswith('['):
            current = line[1:line.index(']')]
            sections[current] = {}
        elif '=' in line and current:
            key, value = line.split('=', 1)
            if 'Content' not in key:
                value = re.sub(r'\s+//.*$', '', value)
            sections[current][key.strip()] = value.strip().replace('\\n', '\n')
    return [sections[str(i)] for i in range(int(sections['count']['count']))]


def number(data, key):
    return int(data[key])


people = [dict(id=d['Name'], **{k.lower(): number(d, k) for k in ['Army', 'Economy', 'Art', 'Science', 'Treachery', 'Leadership', 'Social']}) for d in parse('person.ini')]
stars = [dict(index=i, name=d['Name'], sector=number(d, 'StarSys'), resource=number(d, 'Res'), planet=bool(number(d, 'IsPlanet')), capacity=number(d, 'PopLimit')) for i, d in enumerate(parse('star.ini'))]
aliens = [dict(id=f'alien-{i}', name=d['Name'], population=number(d, 'Population'), army=number(d, 'Army'), level=number(d, 'CiviLevel'), starIndex=number(d, 'StarIndex')) for i, d in enumerate(parse('alien.ini'))]
weapons = [dict(id=d['Name'], tech=d['DependTecName'], kind=['unit', 'bomb', 'spy', 'singularity'][number(d, 'Type')], hp=number(d, 'Hp'), attack=number(d, 'Attack'), priority=number(d, 'Priority'), cost=number(d, 'Cost'), work=number(d, 'BuildWork'), perRound=number(d, 'BuildPerRound'), level=number(d, 'NeedCiviLevel')) for d in parse('weapon.ini')]


def events(name):
    result = []
    for i, d in enumerate(parse(name)):
        result.append(dict(name=d.get('Name', f'random-{i}'), type=int(d.get('EventType', 2)), effect=number(d, 'EventEffect'), value=number(d, 'EventValue'), talks=[dict(speaker=d[f'Talk{j}_Talker'], text=d[f'Talk{j}_Content'], portrait=d[f'Talk{j}_Pic'].removesuffix('.bmp')) for j in range(number(d, 'TalkCount'))]))
    return result


portraits = {}
for i, path in enumerate(sorted((root / 'images').glob('*.bmp'))):
    filename = f'portrait-{i:02}.png'
    dest = media / filename
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-frames:v', '1', '-compression_level', '9', str(dest)], check=True)
    portraits[path.stem] = f'assets/legacy/{filename}'
for name in ['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']:
    shutil.copy2(root / f'images/{name}.jpg', media / f'{name}.jpg')
tracks = []
for i, name in enumerate(['prelude.mp3', '1.mp3', '2.mp3', '3.mp3', '4.wma']):
    dest = media / f'music-{i}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(root / 'music' / name), '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '112k', str(dest)], check=True)
    tracks.append(f'assets/legacy/{dest.name}')
files = ['person.ini', 'star.ini', 'alien.ini', 'weapon.ini', 'gameevent.ini', 'randomevent.ini', 'music.ini']
result = dict(provenance={
    'source': 'User-provided original lou_game runtime distribution',
    'notice': '原始数值、剧情和素材已恢复。仅导入数据、图片和音乐；未运行或复制发行包中的任何可执行文件。',
    'sha256': {f: hashlib.sha256((root / 'data' / f).read_bytes()).hexdigest() for f in files},
    'authorNote': (root / '作者的话.txt').read_bytes().decode('gb18030'),
    'moddingNote': (root / '修改游戏.txt').read_bytes().decode('gb18030'),
}, people=people, stars=stars, aliens=aliens, weapons=weapons, events=events('gameevent.ini'), randomEvents=events('randomevent.ini'), portraits=portraits, tracks=tracks)
output = project / 'src/content/runtime.generated.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'Imported {len(people)} people, {len(stars)} named stars, {len(result["events"])} story events, {len(result["randomEvents"])} random events, {len(portraits)} portraits, {len(tracks)} tracks.')
