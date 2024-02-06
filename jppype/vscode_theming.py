from IPython.display import display
from ipywidgets import HTML


def vscode_theme():
    theme_mapping = HTML(
        """<style>
    .cell-output-ipywidget-background {
    background-color: transparent !important;
    } 

    :root {
        --jppype-foreground-color: var(--vscode-editor-foreground, var(--jp-content-font-color1));
        --jppype-dim-foreground-color: var(--vscode-input-placeholderForeground, var(--jp-content-font-color2));

        --jppype-dim-background-color: var(--vscode-input-background, var(--jp-layout-color3));
        --jppype-background-color: var(--vscode-editor-background, var(--jp-layout-color2));
        --jppype-highlight-background-color: var(--vscode-panel-background, var(--jp-layout-color1));
    }
    </style>"""
    )
    display(theme_mapping)
