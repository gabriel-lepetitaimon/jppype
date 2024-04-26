from functools import reduce

from IPython.display import display
from ipywidgets import HTML


def vscode_theme(ipywidget=True):
    # Redefine root variables colors to match VSCode theme
    root_vars = {
        "jppype-foreground-color": ("vscode-editor-foreground", "jp-content-font-color1"),
        "jppype-dim-foreground-color": ("vscode-input-placeholderForeground", "jp-content-font-color2"),
        "jppype-dim-background-color": ("vscode-input-background", "jp-layout-color3"),
        "jppype-background-color": ("vscode-editor-background", "jp-layout-color2"),
        "jppype-highlight-background-color": ("vscode-panel-background", "jp-layout-color1"),
    }
    if ipywidget:
        root_vars["jp-widgets-color"] = root_vars["jppype-foreground-color"]

        root_vars["jp-widgets-slider-handle-border-color"] = (("vscode-input-border", "jp-border-color"),)
        root_vars["jp-widgets-slider-handle-background-color"] = (
            "vscode-scrollbarSlider-background",
            "jp-layout-color1",
        )
        root_vars["jp-widgets-slider-active-handle-color"] = ("vscode-focusBorder", "jp-brand-color1")

        root_vars["jp-widgets-input-color"] = ("vscode-input-foreground", "jp-ui-font-color1")
        root_vars["jp-widgets-input-background-color"] = ("vscode-input-background", "jp-layout-color1")
        root_vars["jp-widgets-input-border-color"] = ("vscode-input-border", "jp-border-color")
        root_vars["jp-widgets-slider-active-handle-color"] = ("vscode-inputOption-activeForeground", "jp-brand-color1")
        root_vars["jp-widgets-input-focus-border-color"] = ("vscode-inputOption-activeBorder", "jp-brand-color2")

    root_vars_css = "\n".join(
        f"    --{var_name}: "
        + reduce(lambda x, y: f"var(--{y}, {x})", reversed(var_values[:-1]), f"var(--{var_values[-1]})")
        + ";"
        for var_name, var_values in root_vars.items()
    )

    # Background disabling
    background_css = ""
    if ipywidget:
        background_css = """
        .cell-output-ipywidget-background {
                background: transparent !important;
        }"""
    else:
        background_css = """
        .jbasewidget {
            background: var(--vscode-editor-background, transparent) !important;
        }"""

    theme = (
        "<style>"
        + background_css
        + """
        :root {"""
        + root_vars_css
        + """
        }
        </style>"""
    )

    display(HTML(theme))
