# O.R.C

Oatmeal Raisin Cookie
- A research project for human-centric cybersecurity
- This is a survey-style CTF used to gather information from participants that can be used to understand how we can leverage cognitive biases to improve cyber defenses
- This research involved the study of the Sunk Cost Fallacy throughout our simulated pen-testing event

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Dependencies

Follow these steps for initial setup after cloning the repository:
1. Run 'npm install'
2. Use 'npm install survey-react-ui survey-core' in your IDE to install the dependencies.
3. Run 'npm run dev'

Ensure that your Node.js is up to date, if not, follow this link to install the latest version:
https://nodejs.org/en/download

(When prompted, check the box to install all necessary tools)

NOTE: you may need to restart your IDE after installing Node.js

For VScode:
- If an error pops up after completing the steps above, type this command into the terminal:

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
