
const gluestackPlugin = require('@gluestack-ui/nativewind-utils/tailwind-plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "['media', 'selector']",
  content: ["./app/**/*.{tsx,jsx,ts,js}", "./components/**/*.{tsx,jsx,ts,js}", "nativewind-env.d.ts"],
  presets: [require('nativewind/preset')],
  tailwindFunctions: ["tva"],
  safelist: [
    {
      pattern:
        /(bg|border|text|stroke|fill)-(primary|secondary|tertiary|error|success|warning|info|typography|outline|background)-(0|50|100|200|300|400|500|600|700|800|900|950|white|gray|black|error|warning|muted|success|info|light|dark)/,
    },
  ],
  theme: {
    colors: {
      'm-01': 'rgb(var(--m-01))',
      'm-01--light-01': 'rgb(var(--m-01--light-01) / <alpha-value>)',
      'm-01--light-02': 'rgb(var(--m-01--light-02) / <alpha-value>)',
      'm-01--light-03': 'rgb(var(--m-01--light-03) / <alpha-value>)',
      'm-01--light-04': 'rgb(var(--m-01--light-04) / <alpha-value>)',
      'm-01--dark-01': 'rgb(var(--m-01--dark-01) / <alpha-value>)',

      'm-02': 'rgb(var(--m-02) / <alpha-value>)',
      'm-02--dark-01': 'rgb(var(--m-02--dark-01) / <alpha-value>)',
      'm-02--dark-02': 'rgb(var(--m-02--dark-02) / <alpha-value>)',
      'm-02--light-01': 'rgb(var(--m-02--light-01) / <alpha-value>)',
      'm-02--light-02': 'rgb(var(--m-02--light-02) / <alpha-value>)',
      'm-02--light-03': 'rgb(var(--m-02--light-03) / <alpha-value>)',

      'neu-01': 'rgb(var(--neu-01) / <alpha-value>)',
      'neu-02': 'rgb(var(--neu-02) / <alpha-value>)',
      'neu-03': 'rgb(var(--neu-03) / <alpha-value>)',
      'neu-04': 'rgb(var(--neu-04) / <alpha-value>)',
      'neu-05': 'rgb(var(--neu-05) / <alpha-value>)',
      'neu-06': 'rgb(var(--neu-06) / <alpha-value>)',
      'neu-07': 'rgb(var(--neu-07) / <alpha-value>)',
      'neu-08': 'rgb(var(--neu-08) / <alpha-value>)',
      'neu-09': 'rgb(var(--neu-09) / <alpha-value>)',
      'neu-10': 'rgb(var(--neu-10) / <alpha-value>)',
      'neu-11': 'rgb(var(--neu-11) / <alpha-value>)',
      'neu-12': 'rgb(var(--neu-12) / <alpha-value>)',
      'neu-13': 'rgb(var(--neu-13) / <alpha-value>)',

      burgundy: 'rgb(var(--burgundy) / <alpha-value>)',
      red: 'rgb(var(--red) / <alpha-value>)',
      orange: 'rgb(var(--orange) / <alpha-value>)',
      yellow: 'rgb(var(--yellow) / <alpha-value>)',
      teal: 'rgb(var(--teal) / <alpha-value>)',
      cyan: 'rgb(var(--cyan) / <alpha-value>)',
      lime: 'rgb(var(--lime) / <alpha-value>)',
      lightGreen: 'rgb(var(--lightGreen) / <alpha-value>)',
      darkGreen: 'rgb(var(--darkGreen) / <alpha-value>)',
      blue: 'rgb(var(--blue) / <alpha-value>)',

      'gra-01': 'var(--gra-01)',
      'gra-02': 'var(--gra-02)',
      'gra-03': 'var(--gra-03)',
      'gra-03--inverted': 'var(--gra-03--inverted)',
      'gra-04': 'var(--gra-04)',
      'gra-05': 'var(--gra-05)',
      'gra-05--inverted': 'var(--gra-05--inverted)',
      'gra-06': 'var(--gra-06)',
      'gra-06--inverted': 'var(--gra-06--inverted)',
      'gra-07': 'var(--gra-07)',
      'gra-07--inverted': 'var(--gra-07--inverted)',
    },
    fontFamily: {
      sourceSansPro: ['sourceSansPro_regular'],
    },

    fontWeights: {
      normal: '400',
      semiBold: '600',
      bold: '700',
    },
    zIndices: {
      1: '1',
      2: '10',
      3: '100',
    },
    spacing: {
      0: '0px',
      4: '4px',
      8: '8px',
      16: '16px',
      24: '24px',
      32: '32px',
      40: '40px',
      48: '48px',
      56: '56px',
      64: '64px',
    },
    extend: {

      fontFamily: {
        heading: undefined,
        body: undefined,
        mono: undefined,
        roboto: ['Roboto', 'sans-serif'],
      },
      fontSize: {
        10: '0.625rem',
        12: '0.75rem',
        14: '0.875rem',
        16: '1rem',
        18: '1.125rem',
        20: '1.25rem',
      },
      boxShadow: {
        'sha-01': '0px 5px 10px rgba(19, 20, 19, 0.12)',
        'sha-02': '0px 4px 12px rgba(19, 20, 19, 0.04)',
        'sha-03': '0px 6px 24px rgba(52, 183, 120, 0.2)',
        'sha-04': '0px 32px 72px rgba(19, 20, 19, 0.4)',
        'sha-05': '0px -5px 10px rgba(19, 20, 19, 0.12)',
        'sha-06': '0px 5px 18px rgba(19, 20, 19, 0.3)',
        'sha-07': '-2px 2px 3px -1px rgba(19, 20, 19, 0.32)',
        'hard-1': '-2px 2px 8px 0px rgba(38, 38, 38, 0.20)',
        'hard-2': '0px 3px 10px 0px rgba(38, 38, 38, 0.20)',
        'hard-3': '2px 2px 8px 0px rgba(38, 38, 38, 0.20)',
        'hard-4': '0px -3px 10px 0px rgba(38, 38, 38, 0.20)',
        'hard-5': '0px 2px 10px 0px rgba(38, 38, 38, 0.10)',
        'soft-1': '0px 0px 10px rgba(38, 38, 38, 0.1)',
        'soft-2': '0px 0px 20px rgba(38, 38, 38, 0.2)',
        'soft-3': '0px 0px 30px rgba(38, 38, 38, 0.1)',
        'soft-4': '0px 0px 40px rgba(38, 38, 38, 0.1)',
      },
      backgroundImage: {
        'gra-01':
          'linear-gradient(106.45deg, rgb(var(--m-01--light-01)) 8.47%, rgb(var(--m-02--dark-01)) 92.4%)',
        'gra-02':
          'linear-gradient(112.63deg,  rgb(var(--m-02)) 10.93%,  rgb(var(--m-01--light-01))  88.2%)',
        'gra-03':
          'linear-gradient(97.5deg, rgb(var(--m-02--dark-01)) 4.32%, rgb(var(--m-02--light-02)) 94.22%)',
        'gra-03--inverted':
          'linear-gradient(97.5deg, rgb(var(--m-02--light-02)) 4.32%, rgb(var(--m-02--dark-01))  94.22%)',
        'gra-04':
          'linear-gradient(360deg, rgb(var(--m-01)) 0%, rgb(var(--m-01--light-01)) 100%)',
        'gra-05':
          'linear-gradient(97.5deg, rgb(var(--neu-10)) 4.32%,rgb(var(--neu-09)) 94.22%)',
        'gra-05--inverted':
          'linear-gradient(97.5deg, rgb(var(--neu-09)) 4.32%, rgb(var(--neu-01)) 94.22%)',
        'gra-06':
          'linear-gradient(97.5deg, rgb(var(--neu-08))  4.32%, rgb(var(--neu-07))  94.22%)',
        'gra-06--inverted':
          'linear-gradient(97.5deg, rgb(var(--neu-07)) 4.32%, rgb(var(--neu-08)) 94.22%)',
        'gra-07':
          'linear-gradient(97.5deg, rgb(var(--neu-06))  4.32%, rgb(var(--neu-05))  94.22%)',
        'gra-07--inverted':
          'linear-gradient(97.5deg, rgb(var(--neu-05)) 4.32%, rgb(var(--neu-06))  94.22%)',
      },
      flex: {
        '2': '2 2 0%',
        '5': '5 5 0%',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down':
          'accordion-down 0.3s cubic-bezier(0.04, 0.62, 0.23, 0.98)',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      spacing: {
        '1/7': 'calc(100% / 7)',
      },
      transitionTimingFunction: {
        'tabs-ease': 'cubic-bezier(0, 0.48, 0.09, 1.15)',
      },
    },
  },

  plugins: [gluestackPlugin, 'prettier-plugin-tailwindcss',
    ({ addBase }) => addBase({
      ":root": {
        "--m-01": "24 124 86",
        "--m-01--light-01": "38 151 108",
        "--m-01--light-02": "52 183 120",
        "--m-01--light-03": "58 206 135",
        "--m-01--light-04": "102 227 167",
        "--m-01--dark-01": "36 87 68",

        "--m-02": "118 197 39",
        "--m-02--dark-01": "106 184 69",
        "--m-02--dark-02": "103 170 71",
        "--m-02--light-01": "139 221 33",
        "--m-02--light-02": "151 233 46",
        "--m-02--light-03": "191 243 124",

        "--neu-01": "255 255 255",
        "--neu-02": "249 249 249",
        "--neu-03": "240 241 241",
        "--neu-04": "227 229 228",
        "--neu-05": "218 221 219",
        "--neu-06": "195 200 198",
        "--neu-07": "139 149 145",
        "--neu-08": "112 123 119",
        "--neu-09": "94 103 99",
        "--neu-10": "79 86 84",
        "--neu-11": "49 53 52",
        "--neu-12": "31 34 32",
        "--neu-13": "19 20 19",

        "--burgundy": "120 47 47",
        "--red": "212 66 66",
        "--orange": "248 148 32",
        "--yellow": "255 209 46",
        "--teal": "35 205 174",
        "--cyan": "56 186 215",
        "--lime": "139 221 33",
        "--lightGreen": "52 183 120",
        "--darkGreen": "24 124 86",
        "--blue": "20 121 178",

        "--gra-01": "106.45deg, rgb(var(--m-01--light-01)) 8.47%, rgb(var(--m-02--dark-01)) 92.4%",
        "--gra-02": "112.63deg, rgb(var(--m-02)) 10.93%, rgb(var(--m-01--light-01)) 88.2%",
        "--gra-03": "97.5deg, rgb(var(--m-02--dark-01)) 4.32%, rgb(var(--m-02--light-02)) 94.22%",
        "--gra-03--inverted": "97.5deg, rgb(var(--m-02--light-02)) 4.32%, rgb(var(--m-02--dark-01)) 94.22%",
        "--gra-04": "360deg, rgb(var(--m-01)) 0%, rgb(var(--m-01--light-01)) 100%",
        "--gra-05": "97.5deg, rgb(var(--neu-10)) 4.32%, rgb(var(--neu-09)) 94.22%",
        "--gra-05--inverted": "97.5deg, rgb(var(--neu-09)) 4.32%, rgb(var(--neu-01)) 94.22%",
        "--gra-06": "97.5deg, rgb(var(--neu-08)) 4.32%, rgb(var(--neu-07)) 94.22%",
        "--gra-06--inverted": "97.5deg, rgb(var(--neu-07)) 4.32%, rgb(var(--neu-08)) 94.22%",
        "--gra-07": "97.5deg, rgb(var(--neu-06)) 4.32%, rgb(var(--neu-05)) 94.22%",
        "--gra-07--inverted": "97.5deg, rgb(var(--neu-05)) 4.32%, rgb(var(--neu-06)) 94.22%",
        "--appSize": "800px",

        "--font-size-16": "16px" // Fixed the variable name by removing spaces
      },

    })
  ],
};
