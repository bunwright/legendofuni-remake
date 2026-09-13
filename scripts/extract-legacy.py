#!/usr/bin/env python3
"""Recover only content actually present in the GB18030 C++ source distribution.
Usage: python3 scripts/extract-legacy.py [path/to/lengendofuni_src]
The original distribution is not required to build or play the remake.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads/lengendofuni_src'
source = root / 'LengendOfUni'
out = Path(__file__).resolve().parents[1] / 'src/content/legacy.generated.json'


def read(name):
    return (source / name).read_bytes().decode('gb18030')


def unescape(text):
    return text.replace('\\n', '\n').replace('\\r', '\r').replace('\\"', '"').replace('\\t', '\t')


branches = {
    'ASTROSOCIOLOGY': 'sociology', 'NUCLEAR': 'nuclear', 'SPACEFIGHT': 'spaceflight',
    'PROTON': 'proton', 'ASTROPHYSICS': 'astrophysics', 'CULTURETEC': 'culture', 'ECONOMYTEC': 'economy',
}
techs = []
branch = None
pattern = re.compile(r'tecTree->AddNode\(_T\("(.*?)"\), _T\("(.*?)"\), FALSE, (\d+), (\d+), _T\("(.*?)"\)\);')
for line in read('TecTreeManager.cpp').splitlines():
    match = re.search(r'case TT_(\w+):', line)
    if match:
        branch = branches[match[1]]
    match = pattern.search(line)
    if match:
        parent, name, work, cost, desc = match.groups()
        techs.append(dict(id=name, parent=None if parent == 'root' else parent,
                          branch=branch, work=int(work), cost=int(cost), description=unescape(desc)))
assert len(techs) == 51

people_block = read('PersonManager.cpp').split('sPersonNameArray[] = {')[1].split('};')[0]
people = re.findall(r'_T\("(.*?)"\)', people_block)
assert len(people) == 28
alien_block = read('AlienCiviManager.cpp').split('sAlienNameArray[] = {')[1].split('};')[0]
aliens = re.findall(r'_T\("(.*?)"\)', alien_block)
weapon_block = read('WeaponManager.cpp').split('sWeaponNameArray[] = {')[1].split('};')[0]
weapons = re.findall(r'_T\("(.*?)"\)', weapon_block)
quote_block = read('City.cpp').split('CString sTalk[] = {')[1].split('};')[0]
quotes = [unescape(q) for q in re.findall(r'_T\("(.*?)"\)', quote_block)]
diplomacy_block = read('AlignmentDlg.cpp').split('CString sInfoArray[] = {')[1].split('};')[0]
questions = [unescape(q) for q in re.findall(r'_T\("(.*?)"\)', diplomacy_block)]
files = ['TecTreeManager.cpp', 'PersonManager.cpp', 'AlienCiviManager.cpp', 'WeaponManager.cpp', 'City.cpp', 'AlignmentDlg.cpp']
result = {
    'provenance': {'title': '刘慈欣群星传', 'author': '傲雪小组 / Tormoo', 'sourceRelease': '2009-04-19',
                   'notice': '仅抽取源码中实际存在的内容。发行版 INI、剧情、美术及音乐不在源码包中。',
                   'sha256': {f: hashlib.sha256((source / f).read_bytes()).hexdigest() for f in files}},
    'technologies': techs, 'peopleNames': people, 'alienNames': aliens, 'weaponNames': weapons,
    'discoveryQuotes': quotes, 'diplomacyQuestions': questions,
}
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'Recovered {len(techs)} technologies, {len(people)} people, {len(aliens)} civilizations, {len(weapons)} weapons → {out}')
