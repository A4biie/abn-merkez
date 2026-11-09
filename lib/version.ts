// Uygulama sürümü tek yerde: app.json → expo.version. Her yerde bu sabit kullanılır.
// Kural: yeni özellik 0.x.0, düzeltme 0.x.y. Sürüm yükselince CHANGELOG.md'ye de yazılır.

import app from '@/app.json';

export const APP_VERSION: string = app.expo.version;
