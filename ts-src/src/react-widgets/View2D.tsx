import { CSSProperties, useMemo, useRef } from "react";
import { JView2DModel } from "../ipywidgets/JView2D";
import { JModelContext, useModelEvent } from "../ipywidgets/jbasewidget";
import { Point, Rect } from "../utils/point";
import {
  MouseEventsListener,
  Transform,
  useSceneMouseEventListener,
  useZoomTransform,
} from "../utils/zoom-pan-handler";
/* import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Typography,
} from '@mui/material';
import ControlCameraIcon from '@mui/icons-material/ControlCamera';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'; */
import { ThemeProvider } from "@mui/material/styles";

import RulerAxis from "../react-components/RulerAxis";
import View2DRender from "../react-components/View2DRender";

import { Observable } from "rxjs";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import "../../css/View2D.css";
import { useTheme } from "../utils/mui";
import { instantiatedStore, synchronizableStates } from "../utils/zustand-utils";
import RectSelectionOverlay from "../react-components/RectSelectionOverlay";
import CursorOverlay from "../react-components/CursorOverlay";

interface View2DProps {
  model: JView2DModel;
  events?: MouseEventsListener;
}

interface WidgetState {
  transform: Transform;
  cursorPos: Point | null;
}

const useImageViewerStore = instantiatedStore(() =>
  create<WidgetState>()(
    synchronizableStates(
      subscribeWithSelector(() => ({
        transform: {
          center: new Point(0.5, 0.5),
          coord: "relative",
          zoom: 0,
        } as Transform,
        cursorPos: null as Point | null,
      }))
    )
  )
);

function View2D(props: View2DProps) {
  // --- STATES ---
  const ref = useRef<HTMLDivElement | null>(null);
  // const [layers] = JView2DModel.use('_layers_data');
  const [_] = JView2DModel.use("_loading");
  const [areaSelected] = JView2DModel.use("_area_selected");
  const [hideForeground] = JView2DModel.use("_hide_foreground");
  const [showLeftRuler] = JView2DModel.use("_left_ruler");
  const [showTopRuler] = JView2DModel.use("_top_ruler");

  const model = props.model;
  const viewerStore = useImageViewerStore(model.instanceID);
  const domain = model.domain;
  const layers_data = model.layers_data;
  const layers_options = model.layers_options;

  let sceneRect = Rect.EMPTY;
  Object.values(layers_options).forEach((layer) => {
    sceneRect = sceneRect.union(layer.domain);
  });

  useMemo(() => {
    viewerStore.setSync(props.model.linkedTransformGroup);
  }, [props.model.linkedTransformGroup]);

  const syncTransform: [Observable<Transform>, (t: Transform) => void] = useMemo(() => {
    let lastValue: Transform | undefined = undefined;
    const observable = new Observable<Transform>((subcriber) => {
      viewerStore.subscribe(
        (s: WidgetState) => s.transform,
        (t: Transform) => {
          props.model.set("_transform", t);
          props.model.saveWithTimeout();
          if (t && lastValue !== t) {
            subcriber.next(t);
            lastValue = t;
          }
        }
      );
    });

    const observer = (t: Transform) => {
      lastValue = t;
      viewerStore.setState({ transform: t });
    };
    return [observable, observer];
  }, []);

  const zoomTransform = useZoomTransform(ref, sceneRect, 50, domain, syncTransform);

  const syncCursorPos: [Observable<Point | null>, (p: Point | null) => void] = useMemo(() => {
    const observable = new Observable<Point | null>((subcriber) => {
      viewerStore.subscribe(
        (s: WidgetState) => s.cursorPos,
        (p: Point | null) => subcriber.next(p)
      );
    });
    const observer = (p: Point | null) => viewerStore.setState({ cursorPos: p });
    return [observable, observer];
  }, []);
  const cursorPos = useSceneMouseEventListener(zoomTransform, props.events, true, syncCursorPos);

  useModelEvent("change:_target_transform", (model) => {
    zoomTransform.dispatch({
      transform: model.get("_target_transform"),
      animation: { duration: 500 },
    });
  });

  const panHorizontally = (delta: number): void => {
    zoomTransform.dispatch({
      pan: new Point(delta, 0),
    });
  };
  const panVertically = (delta: number): void => {
    zoomTransform.dispatch({
      pan: new Point(0, delta),
    });
  };

  const setCenterHorizontally = (center: number): void => {
    zoomTransform.dispatch({
      center: new Point(center, zoomTransform.center.y),
    });
  };
  const setCenterVertically = (center: number): void => {
    zoomTransform.dispatch({
      center: new Point(zoomTransform.center.x, center),
    });
  };

  // --- STYLE ---
  const rulerProps = {
    thickness: 15,
    scale: zoomTransform.scale,
  };

  const widgetStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: showLeftRuler ? `${rulerProps.thickness}px auto` : "auto",
    gridTemplateRows: showTopRuler ? `${rulerProps.thickness}px auto` : "auto",
  };

  const t = zoomTransform;

  const sceneSize = t.sceneRect.size.multiply(zoomTransform.scale);

  const center = zoomTransform.areaState.viewSize.half().subtract(
      (t.center.subtract(t.sceneRect.topLeft).add(t.sceneDomain.topLeft))
      .multiply(t.scale)
    );

  // const cx = (zoomTransform.center.x - zoomTransform.sceneRect.left + zoomTransform.sceneDomain.left) * zoomTransform.scale;
  // const cy = h/2 - (zoomTransform.center.y - zoomTransform.sceneRect.top + zoomTransform.sceneDomain.top) * zoomTransform.scale;

  const sceneTransform: CSSProperties = {
    width: `${sceneSize.x}px`,
    height: `${sceneSize.y}px`,
    position: "absolute",
    left: `${center.x}px`,
    top: `${center.y}px`,
  };

  const topRuler = showTopRuler 
    ? (<RulerAxis
      orientation={"horizontal"}
      center={zoomTransform.center.x}
      cursorPos={cursorPos?.x}
      onPanCenter={panHorizontally}
      onSetCenter={setCenterHorizontally}
      axisInterval={{ start: zoomTransform.sceneDomain.left, end: zoomTransform.sceneDomain.right }}
      style={{ gridRow: 1, gridColumn: showLeftRuler ? 2 : 1 }}
      {...rulerProps}
    />)
    : null;

  const leftRuler = showLeftRuler
    ? (<RulerAxis
      orientation={"vertical"}
      center={zoomTransform.center.y}
      cursorPos={cursorPos?.y}
      onPanCenter={panVertically}
      onSetCenter={setCenterVertically}
      axisInterval={{ start: zoomTransform.sceneDomain.top, end: zoomTransform.sceneDomain.bottom }}
      style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: 1 }}
      {...rulerProps}
    />)
    : null;

  // --- RENDER --- 
  return (
    <div className="ImageViewerWidget" style={widgetStyle}>
      
      {topRuler}
      {leftRuler}

      <div ref={ref} style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: showLeftRuler ? 2 : 1, cursor: "crosshair" }}>
        <div className={"ImageViewport" + (hideForeground ? ' hideForegroundLayers' : '')}>
          <div style={sceneTransform}>
            <View2DRender
              layers={layers_data}
              options={layers_options}
              sceneDomain={sceneRect}
              scale={zoomTransform.scale}
            />
            <RectSelectionOverlay
              sceneDomain={sceneRect}
              selection={areaSelected}
              shadowOpacity={0.5}
            />
          </div>
        </div>
        <div className={"ImageViewportOverlays"}>  
          <CursorOverlay sceneDomain={sceneRect} cursorPos={cursorPos} transform={zoomTransform}/>
        </div>
      </div>
    </div>
  );
}

/*
interface SettingsProps {
  thickness: number;
}

function Settings(props: SettingsProps) {
  const settingsIconStyle: CSSProperties = {
    height: props.thickness - 2,
    color: 'var(--jp-inverse-layout-color3)',
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        size="small"
        style={{ gridRow: 1, gridColumn: 1 }}
        onClick={handleClick}
      >
        <SettingsIcon style={settingsIconStyle} />
      </IconButton>
      <Menu
        sx={{ width: 250 }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        MenuListProps={{ dense: true }}
      >
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <ControlCameraIcon />
          </ListItemIcon>
          <ListItemText primary="Go To" />
          <Typography variant="body2" color="text.secondary">
            G
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <LinkIcon />
          </ListItemIcon>
          <ListItemText primary="Link View" />
          <Switch
            edge="end"
            // onChange={handleToggle('wifi')}
            // checked={checked.indexOf('wifi') !== -1}
          />
          <Typography variant="body2" color="text.secondary">
            L
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <FullscreenIcon />
          </ListItemIcon>
          <ListItemText primary="Fullscreen" />
          <Typography variant="body2" color="text.secondary">
            F
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <VerticalSplitIcon />
          </ListItemIcon>
          <ListItemText primary="Detach" />
          <Typography variant="body2" color="text.secondary">
            D
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
} */

function withModelContext(Component: (props: View2DProps) => JSX.Element) {
  return (props: View2DProps) => (
    <JModelContext.Provider value={props.model}>
      <ThemeProvider theme={useTheme()}>
        <Component {...props} />
      </ThemeProvider>
    </JModelContext.Provider>
  );
}

export default withModelContext(View2D);
