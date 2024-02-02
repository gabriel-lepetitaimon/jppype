import json

from IPython import display
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from yaml import Loader, load


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, vega):
        self.vega = vega

    def on_modified(self, event):
        self.vega.update()


class Vega:
    def __init__(self, spec):
        self._spec = spec
        if isinstance(spec, str):
            change_handler = ChangeHandler(self)
            self.observer = Observer()
            self.observer.schedule(change_handler, path=spec)
            self.observer.start()

    def __delete__(self):
        self.observer.stop()
        self.observer.join()

    def json(self):
        return json.dumps(self.spec, indent=2)

    @property
    def spec(self):
        if isinstance(self._spec, str):
            if self._spec.endswith(".yaml"):
                spec = load(open(self._spec), Loader=Loader)
            elif self._spec.endswith(".json"):
                spec = json.load(open(self._spec))
        else:
            spec = self._spec
        return spec

    def repr_html(self):
        return f"""
        <div id="vis"></div>
        <script>
        var spec = {self.spec};
        vegaEmbed('#vis', spec);
        </script>
        """

    def _repr_mimebundle_(self, include, exclude):
        return {
            "application/vnd.vega.v5+json": self.json(),
            "text/html": self.repr_html(),
        }

    def update(self):
        display.clear_output(wait=True)
        display.display(self)