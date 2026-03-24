import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import './style.css';
import HeroBanner from './HeroBanner.vue';
import { h } from 'vue';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(HeroBanner),
    });
  },
} satisfies Theme;
