#!/usr/bin/env python3
"""Kiểm tra schematic đã sinh: chạy ERC của KiCad và so netlist KiCad với danh sách
kết nối mong muốn (intent_netlist.json do gen_schematic.py ghi ra).

Nếu mỗi nhóm chân cùng net trong intent trùng khớp đúng với một net KiCad thì
nghĩa là việc đặt dây/nhãn trên bản vẽ không làm sai hay chập kết nối nào.
"""
import collections
import json
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SCH = os.path.normpath(os.path.join(HERE, '..', 'corexy_board', 'corexy_board.kicad_sch'))


def main():
    tmp = tempfile.mkdtemp()
    erc = os.path.join(tmp, 'erc.json')
    net = os.path.join(tmp, 'net.xml')
    subprocess.run(['kicad-cli', 'sch', 'erc', '--format', 'json', '--severity-all', '-o', erc, SCH],
                   check=True, capture_output=True)
    subprocess.run(['kicad-cli', 'sch', 'export', 'netlist', '--format', 'kicadxml', '-o', net, SCH],
                   check=True, capture_output=True)

    ok = True
    violations = [(s['path'], v['severity'], v['description'])
                  for s in json.load(open(erc))['sheets'] for v in s['violations']]
    print(f'ERC: {len(violations)} vi phạm')
    for v in violations:
        print('   ', v)
        ok = ok and v[1] != 'error'

    intent = json.load(open(os.path.join(HERE, 'intent_netlist.json')))
    want = collections.defaultdict(set)
    for node, name in intent.items():
        want[name].add(tuple(node.rsplit('.', 1)))

    got = {}
    for n in ET.parse(net).getroot().iter('net'):
        nodes = {(x.get('ref'), x.get('pin')) for x in n.iter('node') if not x.get('ref').startswith('#')}
        if nodes:
            got[n.get('name')] = nodes
    node_to_net = {nd: name for name, nodes in got.items() for nd in nodes}

    bad = 0
    for name, nodes in sorted(want.items()):
        kicad_nets = {node_to_net.get(nd) for nd in nodes}
        if len(kicad_nets) != 1 or None in kicad_nets:
            print(f'SAI: net {name} bị tách thành {kicad_nets}')
            bad += 1
            continue
        kn = kicad_nets.pop()
        extra = got[kn] - nodes
        if extra:
            print(f'SAI: net {name} (KiCad "{kn}") bị chập thêm chân {sorted(extra)}')
            bad += 1
    wanted_nodes = {nd for nodes in want.values() for nd in nodes}
    stray = [(nm, sorted(nodes)) for nm, nodes in got.items()
             if not nodes & wanted_nodes and not nm.startswith('unconnected-')]
    for s in stray:
        print('SAI: net ngoài dự kiến', s)
        bad += 1

    comps = len(ET.parse(net).getroot().findall('.//components/comp'))
    print(f'Netlist: {comps} linh kiện, {len(want)} net dự kiến, {bad} lỗi so khớp')
    sys.exit(0 if ok and bad == 0 else 1)


if __name__ == '__main__':
    main()
