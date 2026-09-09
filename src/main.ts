import { mount } from 'svelte';
import '@fontsource-variable/dm-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/silkscreen/400.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
