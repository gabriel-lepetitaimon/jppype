import { createTheme, Theme } from '@mui/material/styles';
import { useState } from 'react';

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const useTheme = (): Theme => {
  const [theme] = useState(() =>
    createTheme({
      palette: {
        primary: {
          main: cssVar('--jp-brand-color1'),
          light: cssVar('--jp-brand-color0'),
          dark: cssVar('--jp-brand-color2'),
        },
        secondary: {
          main: '#fd7705',
        },
        text: {
          primary: cssVar('--jp-ui-font-color0'),
          secondary: cssVar('--jp-brand-color0'),
          disabled: cssVar('--jp-ui-font-color3'),
        },
        action: {
          active: cssVar('--jp-inverse-layout-color3'),
          hover: cssVar('--jp-layout-color3'),
          // selected: '',
          disabled: cssVar('--jp-ui-font-color3'),
        },
        background: {
          default: cssVar('--jp-layout-color0'),
          paper: cssVar('--jp-layout-color2'),
        },
        divider: cssVar('--jp-layout-color1'),
      },
      typography: {
        htmlFontSize: 16,
        fontSize: 12,
      },
    })
  );
  return theme;
};
