from setuptools import setup
from pathlib import Path


JS_DIR = Path(__file__).resolve().parent / 'ts-src'

# Representative files that should exist after a successful build
jstargets = [JS_DIR / 'dist' / 'index.ts']

data_files_spec = [
    ('share/jupyter/nbextensions/jppype', 'jppype/nbextension', '*.*'),
    ('share/jupyter/labextensions/jppype', 'jppype/labextension', '**'),
    ('share/jupyter/labextensions/jppype', '.', 'install.json'),
    ('etc/jupyter/nbconfig/notebook.d', '.', 'jppype.json'),
]

try:
    from jupyter_packaging import wrap_installers, npm_builder, get_data_files
    builder = npm_builder(JS_DIR, npm=['yarn'], build_cmd='build:prod')
    # installer = npm_builder(HERE, build_cmd='install:extension', source_dir="src", build_dir=lab_path)
    cmdclass = wrap_installers(pre_develop=builder, pre_dist=builder,
                               ensured_targets=jstargets, skip_if_exists=jstargets)
    datafiles = get_data_files(data_files_spec)
except ImportError:
    cmdclass = {}
    datafiles = []

# See setup.cfg for other parameters
setup(cmdclass=cmdclass,
      data_files=datafiles,)
