import { DOMWidgetModel, DOMWidgetView, WidgetModel } from "@jupyter-widgets/base";
import { ICommandPalette } from "@jupyterlab/apputils";
import { Application } from "@phosphor/application";
import { Widget } from "@phosphor/widgets";
import Backbone from "backbone";
import { DependencyList, createContext, useContext, useEffect, useState } from "react";
import { MODULE_NAME, MODULE_VERSION } from "../version";

//=========================================================================
//          ---   Global Variables Architecture Dependents   ---
//=========================================================================

let _jApp: Application<Widget> | undefined = undefined;

export function initializeJApp(app: Application<Widget>, palette: ICommandPalette): void {
  _jApp = app;
  JBaseCommand.jupyterNotebookAddCommands(app, palette);
}

//=========================================================================
//          ---   JBaseWidget  ---
//=========================================================================
export abstract class JBaseWidget extends DOMWidgetView {
  static jApp(): Application<Widget> | undefined {
    return _jApp;
  }

  constructor(options: any) {
    super(options);
    registerWidget(this);
  }

  send_event(name: string, data: { [key: string]: any }): void {
    this.send({ event: name, data: data });
  }

  protected setActive(active: boolean): void {
    const widget = _registeredJBaseWidgets[this.constructor.name].find((w) => w.widget === this);
    if (widget) {
      widget.active = active;
    }
  }

  protected static addCommand(commandName: string, options: Partial<JBaseCommandOption>): void {
    // if (options.shortcut !== undefined && options.shortcutSelector === undefined) {
    //  options.shortcutSelector = "." + this.cssClassName;
    // }
    JBaseCommand.registerCommand(new JBaseCommand(commandName, [this.name], options));
  }

  render() {
    this.el.classList.add("jbasewidget");
    this.el.classList.add("jbasewidget-" + this.constructor.name);
    this.el.addEventListener("keydown", (e) => {
      if (JBaseCommand.processKeydown(e)) {
        e.preventDefault();
      }
    });
    this.renderJWidget(this.el);
  }

  protected static get cssClassName(): string {
    return "jbasewidget-" + this.name;
  }

  protected abstract renderJWidget(el: HTMLElement): void;
}

let _registeredJBaseWidgets: { [key: string]: { widget: JBaseWidget; active: boolean }[] } = {};

const registerWidget = (widget: JBaseWidget) => {
  const className = widget.constructor.name;
  let similarWidgets = _registeredJBaseWidgets[className];
  if (similarWidgets === undefined) {
    similarWidgets = [];
    _registeredJBaseWidgets[className] = similarWidgets;
  }
  similarWidgets.push({ widget: widget, active: false });
};

//=========================================================================
//          ---   JBaseCommands  ---
//=========================================================================
export interface JBaseCommandOption {
  /**
   *  The function to call when the command is invoked.
   * @param widget The widget instance on which the command is invoked.
   */
  execute: (widget: JBaseWidget) => void;

  /** Whether the command should be invoked even on the widgets that are not active. Default: false. */
  isGlobal: boolean;

  isEnabled: () => boolean;
  isVisible: () => boolean;
  icon: string;
  label: string;
  shortcut: string[];
  shortcutSelector: string;
}

const defaultOptionJBaseCommand: JBaseCommandOption = {
  execute: () => {},
  isGlobal: false,
  isEnabled: () => true,
  isVisible: () => true,
  icon: "",
  label: "",
  shortcut: [],
  shortcutSelector: ".jbasewidget",
};

export class JBaseCommand {
  private opt: JBaseCommandOption;
  constructor(public commandId: string, private concernedWidgetClass: string[], opt: Partial<JBaseCommandOption> = {}) {
    this.opt = { ...defaultOptionJBaseCommand, ...opt };
  }

  protected execute(): boolean {
    let executed = false;
    for (let widgetClass in _registeredJBaseWidgets) {
      if (this.concernedWidgetClass.includes(widgetClass)) {
        for (let w of _registeredJBaseWidgets[widgetClass]) {
          if (this.opt.isGlobal || w.active) {
            this.opt.execute(w.widget);
            executed = true;
          } 
        }
      }
    }
    return executed;
  }

  protected static registeredCommand: JBaseCommand[] = [];

  public static registerCommand(command: JBaseCommand): void {
    JBaseCommand.registeredCommand.push(command);
  }

  public static jupyterNotebookAddCommands(app: Application<Widget>, palette: ICommandPalette): void {
    JBaseCommand.registeredCommand.forEach((command) => {
      let isEnabled = command.opt.isEnabled;
      if (!command.opt.isGlobal)
        isEnabled = () => isEnabled() && _registeredJBaseWidgets[command.concernedWidgetClass[0]].some((w) => w.active);
      app.commands.addCommand(command.commandId, {
        execute: () => command.execute(),
        // iconClass: command.opt.icon,
        label: command.opt.label,
        isEnabled: command.opt.isEnabled,
        isVisible: command.opt.isVisible,
      });
      if (command.opt.shortcut) {
        app.commands.addKeyBinding({
          command: command.commandId,
          keys: command.opt.shortcut,
          selector: command.opt.shortcutSelector,
        });
      }
      palette.addItem({ command: command.commandId, category: "JPPype" });
    });
  }

  public static processKeydown(event: KeyboardEvent): boolean {
    const command = JBaseCommand.registeredCommand.filter((command) => command.opt.shortcut.includes(event.key));
    for (let c of command) {
      if (c.execute())
        return true;
    }
    return false;
  }
}

//=========================================================================
//          ---   JModel  ---
//=========================================================================

export class JModel extends DOMWidgetModel {
  protected view_name = "JBaseWidget";
  protected model_name = "JBaseWidget_Model";
  protected syncTimeout: number | undefined = undefined;

  defaults(): any {
    return {
      ...super.defaults(),
      _model_name: this.model_name,
      _model_module: MODULE_NAME,
      _model_module_version: MODULE_VERSION,
      _view_name: this.view_name,
      _view_module: MODULE_NAME,
      _view_module_version: MODULE_VERSION,
      ...this.defaultState,
    };
  }

  get defaultState(): any {
    return {};
  }

  get instanceID(): number {
    return this.get("_instance_id");
  }

  saveWithTimeout(): void {
    if (this.syncTimeout !== undefined) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.save_changes();
      this.syncTimeout = undefined;
    }, 300);
  }
}

export const JModelContext = createContext<JModel | undefined>(undefined);

/**
 * An escape hatch in case you want full access to the model.
 * @returns Python model
 */
export function useModel(): JModel | undefined {
  return useContext(JModelContext);
}

interface ModelCallback {
  (model: WidgetModel, event: Backbone.EventHandler): void;
}

/**
 * Subscribes a listener to the model event loop.
 * @param event String identifier of the event that will trigger the callback.
 * @param callback Action to perform when event happens.
 * @param deps Dependencies that should be kept up to date within the callback.
 */
export function useModelEvent(event: string, callback: ModelCallback, deps?: DependencyList | undefined): void {
  const model = useModel();

  const dependencies = deps === undefined ? [model] : [...deps, model];
  useEffect(() => {
    const callbackWrapper = (e: Backbone.EventHandler) => model && callback(model, e);
    model?.on(event, callbackWrapper);
    return () => void model?.unbind(event, callbackWrapper);
  }, dependencies);
}

export function createUseModelState<T>() {
  return <K extends keyof T>(name: K): [T[K], (val: T[K], options?: any) => void] => {
    const model = useModel();
    const [state, setState] = useState<T[K]>(model?.get(name as string));

    useModelEvent(
      `change:${String(name)}`,
      (model) => {
        setState(model.get(name as string));
      },
      [name]
    );

    function updateModel(val: T[K], options?: any) {
      model?.set(name, val, options);
      model?.save_changes();
    }

    return [state, updateModel];
  };
}

export function createGetFromContext<T>() {
  return <K extends keyof T>(name: K): T[K] => {
    const model = useModel();
    return model?.get(name as string);
  };
}
