# Jupyter ProtoPype: jppype
[![PyPI version](https://badge.fury.io/py/jppype.svg)](https://badge.fury.io/py/jppype)

Jupyter extensions adding ipywidgets specialized for data-view. It is designed as a frontend for ProtoPype (to be released) but can be used as a standalone.

The widgets work both with Jupyter Notebook and Jupyter Lab.

## Installation

To install use pip:

```bash
pip install jppype
```

## Usage
Import jppype in your notebook and use the widgets:
```python
import jppype as jpp
```

### 2D image viewer
```python
viewer = jpp.View2D()

# Supported image formats: numpy array, torch tensor
image = np.random.rand(100, 100) 
viewer.add_image(image)
viewer
```

## Features coming...

- __Widgets__
  - [x] 2D image viewer
    - [x] Color images layer
    - [x] Label layer
    - [ ] Graph layer
    - [ ] Vector Field layer
  - [ ] Table viewer


- __Python interactivity__
  - [x] Add/Update/Remove layers
  - [x] Callback on click
  - [ ] Async request of user selection (point, area, node, branch...) 

## Development Installation

For a development installation (requires [Node.js](https://nodejs.org) and [Yarn version 1](https://classic.yarnpkg.com/)),
```bash
git clone https://github.com/gabriel-lepetitaimon/jppype.git
cd jppype
pip install -e .
jupyter nbextension install --py --symlink --overwrite --sys-prefix jppype
jupyter nbextension enable --py --sys-prefix jppype
```
When actively developing your extension for JupyterLab, run the command:
```bash
jupyter labextension develop --overwrite jppype
```

Then you need to rebuild the JS when you make a code change:
```bash
cd ts-src
jlpm clean
jlpm build
```
or automatically rebuild when a file changes:
```bash
cd ts-src
jlpm watch
```

You then need to refresh the JupyterLab page when your javascript changes.
