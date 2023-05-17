// Copyright (c) Gabriel Lepetit-Aimon
// Distributed under the terms of the Modified BSD License.

import { Application, IPlugin } from '@phosphor/application';
import { Widget } from '@phosphor/widgets';
import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';

import * as widgetExports from './widgets';

import { MODULE_NAME, MODULE_VERSION } from './version';
import { initializeJApp } from './ipywidgets/jbasewidget';

/**
 * Register the plugin.
 */
const EXTENSION_ID = 'jppype:plugin';
const jppypeWidgetsPlugin: IPlugin<Application<Widget>, void> = {
  id: EXTENSION_ID,
  requires: [IJupyterWidgetRegistry],
  activate: activateWidgetExtension,
  autoStart: true,
} as unknown as IPlugin<Application<Widget>, void>;
// the "as unknown as ..." typecast above is solely to support JupyterLab 1
// and 2 in the same codebase and should be removed when we migrate to Lumino.

export default jppypeWidgetsPlugin;

/**
 * Activate the widget extension.
 */
function activateWidgetExtension(
  app: Application<Widget>,
  registry: IJupyterWidgetRegistry
): void {
  initializeJApp(app);

  registry.registerWidget({
    name: MODULE_NAME,
    version: MODULE_VERSION,
    exports: widgetExports,
  });
}
