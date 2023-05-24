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
    - [x] Graph layer
    - [ ] Vector Field layer
  - [ ] Table viewer


- __Python interactivity__
  - [x] Add/Update/Remove layers
  - [x] Callback on click
  - [ ] Async request of user selection (point, area, node, edge...) 

## Development Installation

Pull the latest version of the repository
```bash
git clone https://github.com/gabriel-lepetitaimon/jppype.git
cd jppype
````

For a development installation (requires [Node.js](https://nodejs.org) and [Yarn version 1](https://classic.yarnpkg.com/)):
```bash
conda create -n jppype python=3.10
conda install -c conda-forge yarn nodejs
```

Download the npm dependencies:
```bash
cd ts-src
npm install
cd ...
```

Upgrade jupyter-lab to version 4.0.0 if necessary:
```bash
pip install -U jupyterlab
```

Install the python package and the extensions in development mode (this stage may take a while as it will build the jupyterlab extension):
```bash
pip install -e .[dev]
jupyter nbextension install --py --symlink --overwrite --sys-prefix jppype
jupyter nbextension enable --py --sys-prefix jppype
```
If you which to develop for JupyterLab, also run the command:
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
npm watch
```

You then need to refresh the JupyterLab page when your javascript changes.
