export default {
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        borderRadius: 12,
      }),
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
        },
      },
      sizeMedium: {
        height: '44px',
      },
      sizeLarge: {
        height: '52px',
        fontSize: '0.95rem',
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 600,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      rounded: {
        borderRadius: 16,
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 12,
        '&.Mui-selected': {
          backgroundColor: theme.palette.action.selected,
        },
        '&.Mui-selected:hover': {
          backgroundColor: theme.palette.action.selected,
        },
      }),
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: ({ theme }) => ({
        minWidth: 0,
        '& .MuiSvgIcon-root': {
          padding: '2px 12px',
          borderRadius: 999,
          boxSizing: 'content-box',
        },
        '&.Mui-selected': {
          color: theme.palette.secondary.main,
          '& .MuiSvgIcon-root': {
            backgroundColor: theme.palette.action.selected,
          },
        },
      }),
      label: {
        fontWeight: 500,
        '&.Mui-selected': {
          fontSize: '0.75rem',
          fontWeight: 600,
        },
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
    },
  },
};
