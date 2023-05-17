import React, { useMemo, useRef } from 'react';
import { useModelEvent, JModelContext } from '../ipywidgets/jbasewidget';
import { JView2DModel } from '../ipywidgets/JView2D';
import {
  SceneMouseEvent,
  Transform,
  useSceneMouseEventListener,
  useZoomTransform,
} from '../utils/zoom-pan-handler';
import {Point, Rect} from '../utils/point';
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
import { ThemeProvider } from '@mui/material/styles';

import RulerAxis from '../react-components/RulerAxis';
import View2DRender from '../react-components/View2DRender';

import { useTheme } from '../utils/mui';
import '../../css/ImageViewerWidger.css';
import { Observable } from 'rxjs';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  instantiatedStore,
  synchronizableStates,
} from '../utils/zustand-utils';

interface EventsHandler {
  onClick?: (ev: SceneMouseEvent) => void;
}

interface View2DProps {
  model: JView2DModel;
  events?: EventsHandler;
}

interface WidgetState {
  transform: Transform;
}

const useImageViewerStore = instantiatedStore(() =>
  create<WidgetState>()(
    synchronizableStates(
      subscribeWithSelector(() => ({
        transform: {
          center: new Point(0.5, 0.5),
          coord: 'relative',
          zoom: 0,
        } as Transform,
      }))
    )
  )
);

function View2D(props: View2DProps) {
  // --- STATES ---
  const ref = useRef<HTMLDivElement | null>(null);
  // const [layers] = JView2DModel.use('_layers_data');
  const [_] = JView2DModel.use('_loading');

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

  const syncTransform: [Observable<Transform>, (t: Transform) => void] =
    useMemo(() => {
      let lastValue: Transform | undefined = undefined;
      const observable = new Observable<Transform>((subcriber) => {
        viewerStore.subscribe(
          (s: WidgetState) => s.transform,
          (t: Transform) => {
            props.model.set('_transform', t);
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

  const userEvents = {
    onClick: props.events?.onClick,
  };

  const zoomTransform = useZoomTransform(ref, sceneRect, 25, domain, syncTransform);
  const cursorPos = useSceneMouseEventListener(zoomTransform, userEvents);

  useModelEvent('change:_target_transform', (model) => {
    console.log('change:_target_transform');
    zoomTransform.dispatch({
      transform: model.get('_target_transform'),
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
  }
  const setCenterVertically = (center: number): void => {
    zoomTransform.dispatch({
      center: new Point(zoomTransform.center.x, center),
    });
  }

  // --- STYLE ---
  const rulerProps = {
    thickness: 15,
    scale: zoomTransform.scale,
  };

  const widgetStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${rulerProps.thickness}px auto`,
    gridTemplateRows: `${rulerProps.thickness}px auto`,
  };

  const cx = zoomTransform.center.x - zoomTransform.sceneRect.left + zoomTransform.sceneDomain.left;
  const cy = zoomTransform.center.y - zoomTransform.sceneRect.top + zoomTransform.sceneDomain.top;

  const sceneTransform: React.CSSProperties = {
    width: `${zoomTransform.sceneRect.width * zoomTransform.scale}px`,
    height: `${zoomTransform.sceneRect.height * zoomTransform.scale}px`,
    position: 'absolute',
    left: `calc(50% ${(cx) < 0 ? '+' : '-'} ${Math.abs(cx) * zoomTransform.scale}px)`,
    top: `calc(50% ${cy < 0 ? '+' : '-'} ${Math.abs(cy) * zoomTransform.scale}px)`,
  };


  // --- RENDER ---
  return (
    <div className="ImageViewerWidget" style={widgetStyle}>
      <RulerAxis
        orientation={'horizontal'}
        center={zoomTransform.center.x}
        cursorPos={cursorPos?.x}
        onPanCenter={panHorizontally}
        onSetCenter={setCenterHorizontally}
        axisInterval={{start: zoomTransform.sceneDomain.left, end: zoomTransform.sceneDomain.right}}
        style={{ gridRow: 1, gridColumn: 2 }}
        {...rulerProps}
      />
      <RulerAxis
        orientation={'vertical'}
        center={zoomTransform.center.y}
        cursorPos={cursorPos?.y}
        onPanCenter={panVertically}
        onSetCenter={setCenterVertically}
        axisInterval={{start: zoomTransform.sceneDomain.top, end: zoomTransform.sceneDomain.bottom}}
        style={{ gridRow: 2, gridColumn: 1 }}
        {...rulerProps}
      />

      <div ref={ref} style={{ gridRow: 2, gridColumn: 2, cursor: 'crosshair' }}>
        <div className={'ImageViewport'}>
          <div style={sceneTransform}>
            <View2DRender
                layers={layers_data}
                options={layers_options}
                sceneDomain={sceneRect}
                scale={zoomTransform.scale}
            />
          </div>
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
  const settingsIconStyle: React.CSSProperties = {
    height: props.thickness - 2,
    color: 'var(--jp-inverse-layout-color3)',
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
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
