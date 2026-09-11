export const $ = (query, parent = document) => parent.querySelector(query);
export const $$ = (query, parent = document) => [...parent.querySelectorAll(query)];
export function escape(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
const paths = {
 mic:'<path d="M12 19v3m7-12v2a7 7 0 0 1-14 0v-2"/><rect width="6" height="13" x="9" y="2" rx="3"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20"/>',
  next: '<path d="M12 5v14m7-7l-7 7l-7-7"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="m8 3 8 0-1 6 3 3v2h-5v7l-2-2v-5H6v-2l3-3z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  collapse: '<path d="m9 6 6 6-6 6M20 4v16"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
export const formatDate = value => new Intl.DateTimeFormat('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value));
export const shortDate = value => new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric' }).format(new Date(value));
export const statusNames = { active:'进行中', paused:'暂歇一下', done:'已完成' };
export const colorNames = { blue:'晴蓝', teal:'苔绿', violet:'浅紫', amber:'暖沙', rose:'烟粉' };
export function colorPicker(color = 'blue') {
  return `<div class="field"><span>时间线颜色</span><div class="color-options">${Object.entries(colorNames).map(([key, name]) => `<label class="color-choice" data-color="${key}" title="${name}"><input type="radio" name="color" value="${key}" aria-label="${name}" ${key === color ? 'checked' : ''}><i></i></label>`).join('')}</div></div>`;
}
