# -*- mode: python ; coding: utf-8 -*-
"""街霸6赛程管理后台 - PyInstaller打包配置"""

import sys
import os

# 添加必要的DLL路径
binaries = []
if sys.platform == 'win32':
    # 添加Python DLL目录
    python_dir = os.path.dirname(sys.executable)
    for dll in ['ffi.dll', 'libffi-8.dll']:
        dll_path = os.path.join(python_dir, 'DLLs', dll)
        if os.path.exists(dll_path):
            binaries.append((dll_path, '.'))

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=binaries,
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=['flask', 'json', 'random', 'copy', 'shutil', 'datetime', 'ctypes', 'ctypes.wintypes'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='街霸6赛程管理后台',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 显示控制台以便查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
