/* 前情提要：古画风格的手绘分镜与叙事。画面全部由程序绘制，不依赖外部图片。 */
(function (root) {
  'use strict';

  const INK = '#2b2119';
  const CINNABAR = '#963d2d';
  const PAPER = '#efe4c9';

  const scenes = [
    {
      id: 'dianchi', numeral: '壹', title: '西南有滇', art: 'landscape',
      caption: '滇池之畔 · 耕田有邑聚',
      label: '手绘长卷：群山环抱滇池，湖畔有干栏屋舍、田亩与椎髻行人',
      source: '《史记·西南夷列传》',
      lines: [
        '两千余年前，滇池之畔。',
        '耕田，有邑聚；椎髻，跣足。',
        '他们没有留下文字，',
        '只在史官笔下留下一行——',
        '「此皆魋结，耕田，有邑聚。」'
      ]
    },
    {
      id: 'cast', numeral: '贰', title: '铸史于铜', art: 'lid',
      caption: '贮贝器盖 · 十人七马',
      label: '手绘俯视图：圆形器盖上环列七组牵马人，中央三人围绕铜鼓',
      source: '贮贝器 · 滇文化独有的器物',
      lines: [
        '滇人无书，遂铸史于铜。',
        '一器贮贝，盖上为台。',
        '十人，七马，环列如生。',
        '这是王侯贵族才能拥有的重器，',
        '也是他们留给后世的史书。'
      ]
    },
    {
      id: 'chief', numeral: '叁', title: '坐鼓者', art: 'center',
      caption: '中心训诫 · 一人坐于铜鼓',
      label: '手绘画像：头领坐于铜鼓之上，左腰佩剑，身后执伞，身前跪者受斥',
      source: '馆方说明 · “似为”推测语气予以保留',
      lines: [
        '中央一人，坐于铜鼓。',
        '左腰佩剑，耳佩环，腕戴宽边玉镯。',
        '身后一人执伞，伞盖已缺；',
        '身前一人跪地，双手平伸。',
        '此景似为头领监驯——一盖之上，等级森然。'
      ]
    },
    {
      id: 'tigers', numeral: '肆', title: '双虎守耳', art: 'vessel',
      caption: '器身两侧 · 双虎为耳',
      label: '手绘器物图：圆筒形贮贝器，两侧虎形耳，腹外散落海贝',
      source: '虎形耳 · 海贝 · 贝币',
      lines: [
        '器身两侧，双虎为耳。',
        '虎首昂起，张口，尾上卷。',
        '器腹之中，盛满海贝。',
        '贝自远方来，虎守于器侧。',
        '财富、权力与记忆，同铸一器。'
      ]
    },
    {
      id: 'tomb', numeral: '伍', title: '重见天日', art: 'tomb',
      caption: '江川李家山 · 51 号墓',
      label: '手绘墓葬剖面：夜色山丘之下，墓室中随葬贮贝器、铜编钟与执伞俑',
      source: '1991—1992 年李家山第二次发掘',
      lines: [
        '西汉之器，沉入江川李家山。',
        '1991 年冬，51 号墓重见天日。',
        '铜编钟、执伞俑、铜鼓同出，',
        '墓主身份极高，很可能是滇国的王或侯。',
        '这页青铜史书，终于被翻开。'
      ]
    },
    {
      id: 'reins', numeral: '陆', title: '缰在手中', art: 'revive',
      caption: '器盖苏醒 · 七缰待续',
      label: '手绘器盖：七组人马环列，第一组被朱笔圈出，一缕缰绳垂向画外',
      source: '本作据馆方资料改编 · 游戏演绎',
      lines: [
        '如今，器盖在你眼前展开。',
        '十人七马，仍在环行。',
        '握住第一缕缰绳，',
        '让这段青铜上的历史，',
        '再走一遍。'
      ]
    }
  ];

  const DEFS = '<defs>' +
    '<filter id="intro-rough" x="-6%" y="-6%" width="112%" height="112%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.048 0.06" numOctaves="2" seed="9" result="noise"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '<linearGradient id="intro-sky" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f2e7cd"/><stop offset="1" stop-color="#e2d2ae"/>' +
    '</linearGradient>' +
    '<linearGradient id="intro-beam" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ffe9a8" stop-opacity=".55"/>' +
    '<stop offset=".55" stop-color="#f6dfa0" stop-opacity=".22"/>' +
    '<stop offset="1" stop-color="#f6dfa0" stop-opacity="0"/>' +
    '</linearGradient></defs>';

  let rnd = seeded(1);

  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedOf(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
  }

  const r = (amount = 1) => (rnd() * 2 - 1) * amount;
  const n = (value, digits = 1) => Number(value).toFixed(digits);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  // 抖动折线模拟毛笔与刻线的涩感；第二遍淡描让线条更像手绘。
  function stroke(points, options) {
    const o = Object.assign({ width: 1.5, opacity: .82, color: INK, wobble: 1.1, sketch: true }, options || {});
    let out = '';
    const passes = o.sketch ? 3 : 1;
    for (let pass = 0; pass < passes; pass++) {
      const d = points.map((point, index) => `${index ? 'L' : 'M'}${n(point[0] + r(o.wobble))} ${n(point[1] + r(o.wobble))}`).join(' ');
      const width = o.width * (pass === 0 ? 1 : pass === 1 ? .7 : 2.1);
      const opacity = pass === 0 ? o.opacity : pass === 1 ? o.opacity * .28 : o.opacity * .1;
      out += `<path d="${d}" fill="none" stroke="${o.color}" stroke-width="${n(width, 2)}" stroke-opacity="${n(opacity, 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return out;
  }

  function wash(points, options) {
    const o = Object.assign({ fill: INK, opacity: .12, stroke: false, width: 1.1 }, options || {});
    const d = 'M' + points.map(point => `${n(point[0] + r(.9))} ${n(point[1] + r(.9))}`).join(' L') + ' Z';
    return `<path d="${d}" fill="${o.fill}" fill-opacity="${o.opacity}"${o.stroke ? ` stroke="${INK}" stroke-width="${o.width}" stroke-opacity=".7"` : ''} stroke-linejoin="round"/>`;
  }

  function seal(x, y, size, char) {
    return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(r(2.4))})">` +
      `<rect width="${size}" height="${size}" fill="${CINNABAR}" fill-opacity=".86"/>` +
      `<text x="${n(size / 2)}" y="${n(size * .73)}" text-anchor="middle" font-family="serif" font-size="${n(size * .62)}" fill="${PAPER}">${char}</text>` +
      '</g>';
  }

  function person(x, y, scale, pose, flip) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${flip ? -scale : scale} ${scale})">`;
    const head = pose === 'kneel' ? 2 : 0;
    g += `<circle cx="${head}" cy="-46" r="4.8" fill="${PAPER}" fill-opacity=".55" stroke="${INK}" stroke-width="1.4"/>`;
    g += `<path d="M${n(head - 3.4)} -50 q3.4 -4.6 6.8 0" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
    g += `<path d="M${n(head - 6)} -49 q1 -3 3 -1" fill="none" stroke="${INK}" stroke-width="1"/>`;
    if (pose === 'kneel') {
      g += stroke([[head - 6, -40], [head - 8, -22], [head - 12, -6], [head + 10, -6], [head + 7, -24], [head + 5, -40]], { width: 1.4 });
      g += stroke([[head - 12, -6], [head - 16, 0], [head + 16, 0]], { width: 1.3 });
      g += stroke([[head - 4, -36], [head + 6, -31], [head + 18, -32]], { width: 1.2 });
      g += stroke([[head - 4, -33], [head + 5, -28], [head + 16, -29]], { width: 1.2 });
    } else if (pose === 'sit') {
      // 坐姿：臀部落在鼓面，双腿垂在鼓前。
      g += stroke([[head - 7, -42], [head - 8, -25], [head - 9, -8], [head + 9, -8], [head + 7, -26], [head + 5, -42]], { width: 1.4 });
      g += stroke([[head - 9, -8], [head - 5, -2], [head - 4, 5]], { width: 1.4 });
      g += stroke([[head + 9, -8], [head + 14, -2], [head + 13, 5]], { width: 1.4 });
      g += stroke([[head - 5, -38], [head + 1, -30], [head + 10, -32]], { width: 1.3 });
      g += stroke([[head + 4, -36], [head + 9, -26], [head + 8, -18]], { width: 1.1 });
    } else {
      g += stroke([[head - 6, -40], [head - 8, -20], [head - 8, -4], [head + 7, -4], [head + 6, -22], [head + 5, -40]], { width: 1.4 });
      g += stroke([[head - 5, -36], [head - 11, -25], [head - 9, -15]], { width: 1.2 });
      g += stroke([[head + 5, -36], [head + 11, -25], [head + 10, -15]], { width: 1.2 });
      g += stroke([[head - 5, -6], [head - 6, 0]], { width: 1.5 });
      g += stroke([[head + 4, -6], [head + 6, 0]], { width: 1.5 });
      g += stroke([[head - 2, -21], [head + 4, -21]], { width: .9, opacity: .5 });
    }
    g += '</g>';
    return g;
  }

  // 近景头领：侧身坐在鼓面，大腿平伸、小腿垂在鼓前，一臂前指。
  // 局部坐标原点即臀部落座处，便于对齐鼓面。
  function seatedChief(x, y, scale, flip) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${flip ? -scale : scale} ${scale})">`;
    g += `<circle cx="2" cy="-40" r="5.2" fill="${PAPER}" fill-opacity=".5" stroke="${INK}" stroke-width="1.4"/>`;
    g += `<path d="M-1.6 -44 q3.6 -5 7.2 0" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
    g += `<path d="M-4.6 -43 q1 -3 3 -1" fill="none" stroke="${INK}" stroke-width="1"/>`;
    g += stroke([[2, -34], [-1, -22], [0, -8]], { width: 1.6 });
    g += stroke([[-4, -33], [0, -32]], { width: 1.3 });
    g += stroke([[-3, -12], [2, -11]], { width: 1.1, opacity: .6 });
    // 前腿：大腿平放鼓面，小腿垂过鼓沿。
    g += stroke([[0, -7], [10, -5], [21, -5]], { width: 1.5 });
    g += stroke([[21, -5], [23, 6], [23, 13]], { width: 1.5 });
    g += stroke([[23, 13], [29, 13]], { width: 1.3 });
    // 后腿。
    g += stroke([[-2, -6], [8, 0], [10, 10]], { width: 1.4 });
    g += stroke([[10, 10], [16, 10]], { width: 1.2 });
    // 撑在鼓面的手与前指的手臂。
    g += stroke([[-1, -28], [-7, -18], [-8, -8]], { width: 1.3 });
    g += stroke([[2, -30], [15, -26], [28, -27]], { width: 1.4 });
    g += stroke([[28, -27], [32, -28]], { width: 1.1 });
    g += '</g>';
    return g;
  }

  function horse(x, y, scale, flip) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${flip ? -scale : scale} ${scale})">`;
    g += stroke([[-30, -24], [-27, -38], [-10, -43], [10, -40], [20, -31], [15, -22], [-8, -20], [-24, -22], [-30, -24]], { width: 1.5, opacity: .9 });
    g += stroke([[14, -37], [24, -52], [31, -55]], { width: 1.5 });
    g += stroke([[31, -55], [40, -56], [44, -49], [36, -44], [27, -47]], { width: 1.5 });
    g += stroke([[36, -56], [38, -63]], { width: 1.2 });
    g += stroke([[30, -54], [31, -61]], { width: 1.2 });
    g += stroke([[23, -49], [29, -47]], { width: 1, opacity: .5 });
    g += stroke([[12, -24], [14, -10], [15, 0]], { width: 1.4 });
    g += stroke([[5, -23], [6, -9], [8, 0]], { width: 1.3 });
    g += stroke([[-25, -24], [-27, -9], [-29, 0]], { width: 1.4 });
    g += stroke([[-17, -24], [-15, -9], [-13, 0]], { width: 1.3 });
    g += stroke([[11, 0], [17, 0]], { width: 1.1, opacity: .6, sketch: false });
    g += stroke([[-31, 0], [-25, 0]], { width: 1.1, opacity: .6, sketch: false });
    g += stroke([[-30, -36], [-40, -28], [-45, -14], [-42, -2]], { width: 1.3 });
    g += stroke([[-13, -41], [-2, -44], [9, -41]], { width: 1.1, opacity: .55 });
    g += `<circle cx="37" cy="-51" r=".9" fill="${INK}"/>`;
    g += '</g>';
    return g;
  }

  function tigerEar(x, y, scale, flip) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${flip ? -scale : scale} ${scale})">`;
    // 侧首向上的虎形耳：吻部朝外，张口露齿，前爪攀器口，长尾上卷。
    g += stroke([[8, -60], [-4, -67], [-18, -63], [-29, -56], [-33, -49], [-27, -43], [-17, -44], [-15, -39], [-2, -38], [10, -43], [15, -52], [8, -60]], { width: 1.8 });
    g += stroke([[2, -67], [5, -78], [15, -69]], { width: 1.6 });
    g += stroke([[15, -69], [18, -77], [21, -69]], { width: 1.2, opacity: .7 });
    g += stroke([[-27, -50], [-33, -41], [-23, -40], [-16, -45]], { width: 1.5 });
    g += stroke([[-28, -48], [-26, -42]], { width: 1.2, opacity: .85 });
    g += stroke([[-22, -47], [-21, -42]], { width: 1.2, opacity: .85 });
    g += stroke([[1, -58], [6, -54]], { width: 1, opacity: .55 });
    g += stroke([[-31, -53], [-45, -50]], { width: .8, opacity: .45, sketch: false });
    g += stroke([[-31, -47], [-44, -40]], { width: .8, opacity: .45, sketch: false });
    g += stroke([[-24, -38], [-25, -33], [-19, -35]], { width: .9, opacity: .5 });
    // 颈与身，紧贴器壁向下。
    g += stroke([[9, -41], [16, -24], [20, 2], [18, 24], [12, 43], [-2, 44], [-6, 24], [-3, 0], [3, -24]], { width: 1.7 });
    // 前爪攀住器口，后爪踏于器腹。
    g += stroke([[-3, -24], [-12, -20], [-22, -17]], { width: 1.4 });
    g += stroke([[-22, -17], [-26, -13]], { width: 1, opacity: .8 });
    g += stroke([[-18, -16], [-21, -12]], { width: 1, opacity: .8 });
    g += stroke([[12, 43], [20, 47]], { width: 1.3 });
    g += stroke([[5, 44], [9, 49]], { width: 1.1, opacity: .7 });
    // 虎纹。
    [-20, -8, 4, 16, 28].forEach(dy => { g += stroke([[-1, dy], [15, dy + 4]], { width: 1.4, opacity: .6 }); });
    g += stroke([[4, -34], [12, -30]], { width: 1.1, opacity: .5 });
    // 长尾自腰后上卷。
    g += stroke([[15, 4], [33, -4], [43, -22], [37, -40], [25, -42], [20, -31]], { width: 1.7 });
    g += `<circle cx="-8" cy="-56" r="1.5" fill="${INK}"/>`;
    g += stroke([[-2, -52], [1, -50], [4, -52]], { width: 1 });
    g += '</g>';
    return g;
  }

  function cowrie(x, y, scale, rotate) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotate)}) scale(${scale})">`;
    g += `<ellipse cx="0" cy="0" rx="14" ry="9" fill="#e2d3ae" fill-opacity=".45" stroke="${INK}" stroke-width="1.2" stroke-opacity=".75"/>`;
    g += stroke([[-11, -2], [0, 2], [11, -1]], { width: .8, opacity: .5, sketch: false });
    g += stroke([[-8, 3], [0, 5], [8, 3]], { width: .7, opacity: .4, sketch: false });
    g += stroke([[-9, -3], [-7, -6]], { width: .7, opacity: .4, sketch: false });
    g += '</g>';
    return g;
  }

  function drum(cx, cy, scale) {
    let g = `<g transform="translate(${n(cx)} ${n(cy)}) scale(${scale})">`;
    g += `<ellipse cx="0" cy="0" rx="30" ry="9" fill="${PAPER}" fill-opacity=".5" stroke="${INK}" stroke-width="1.2"/>`;
    g += stroke([[-30, 0], [-26, 26]], { width: 1.4 });
    g += stroke([[30, 0], [26, 26]], { width: 1.4 });
    g += `<ellipse cx="0" cy="26" rx="26" ry="8" fill="none" stroke="${INK}" stroke-width="1.2" stroke-opacity=".8"/>`;
    g += stroke([[-14, -2], [-10, 24]], { width: .8, opacity: .4, sketch: false });
    g += stroke([[4, -4], [6, 24]], { width: .8, opacity: .4, sketch: false });
    g += '</g>';
    return g;
  }

  // 器盖：七组牵马环列，中央三人。
  function lidRing(cx, cy, rx, ry, options) {
    const o = Object.assign({ scale: .52, highlight: -1, showEars: true, showSeal: true }, options || {});
    let s = '';
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${PAPER}" fill-opacity=".35" stroke="${INK}" stroke-width="2" stroke-opacity=".85"/>`;
    [1, .95, .88, .55, .5].forEach((k, i) => {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${n(rx * k)}" ry="${n(ry * k)}" fill="none" stroke="${INK}" stroke-width="${i < 2 ? 1.1 : .8}" stroke-opacity="${i < 2 ? .5 : .32}"/>`;
    });
    for (let i = 0; i < 84; i++) {
      const a = i * Math.PI * 2 / 84;
      const x1 = cx + Math.cos(a) * rx * .9, y1 = cy + Math.sin(a) * ry * .9;
      const x2 = cx + Math.cos(a) * rx * .955, y2 = cy + Math.sin(a) * ry * .955;
      s += `<path d="M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}" stroke="${INK}" stroke-width="${i % 6 ? .5 : .9}" stroke-opacity=".32"/>`;
    }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 7;
      const px = cx + Math.cos(a) * rx * .755, py = cy + Math.sin(a) * ry * .755;
      const deg = a * 180 / Math.PI + 90;
      s += `<g transform="translate(${n(px)} ${n(py)}) rotate(${n(deg)})">`;
      if (i === o.highlight) s += `<circle cx="14" cy="-18" r="30" fill="none" stroke="${CINNABAR}" stroke-width="1.4" stroke-opacity=".65"/>`;
      s += person(-14, 0, o.scale, 'stand', false);
      s += horse(14, 2, o.scale, false);
      s += stroke([[-9, -19], [8, -29], [26, -29]], { width: .8, opacity: .5, sketch: false });
      s += '</g>';
    }
    s += drum(cx, cy + 38, 1);
    s += person(cx, cy + 34, .92, 'sit', false);
    s += person(cx - 46, cy + 52, .62, 'stand', false);
    s += stroke([[cx - 46, cy + 20], [cx - 50, cy - 62]], { width: 1.2 });
    s += stroke([[cx - 54, cy - 62], [cx - 47, cy - 67]], { width: 1.1 });
    s += stroke([[cx - 50, cy - 62], [cx - 58, cy - 57]], { width: 1.1 });
    s += person(cx + 40, cy + 58, .7, 'kneel', true);
    if (o.showEars) {
      s += tigerEar(cx - rx - 14, cy + 28, .8, false);
      s += tigerEar(cx + rx + 14, cy + 28, .8, true);
    }
    if (o.showSeal) s += seal(cx + rx - 26, cy + ry - 40, 36, '滇');
    return s;
  }

  function mountains() {
    let s = '';
    [
      { y: 246, amp: 64, color: '#5d6f5b', opacity: .15 },
      { y: 274, amp: 42, color: '#43584a', opacity: .12 }
    ].forEach((ridge, index) => {
      const points = [[-20, 300]];
      for (let x = -20; x <= 780; x += 52) points.push([x, ridge.y - rnd() * ridge.amp - (index ? 0 : Math.cos(x / 150) * 18)]);
      points.push([780, 300]);
      const d = 'M-20 308 L' + points.map(point => `${n(point[0])} ${n(point[1])}`).join(' L') + ' L780 308 Z';
      s += `<path d="${d}" fill="${ridge.color}" fill-opacity="${ridge.opacity}" stroke="none"/>`;
      s += stroke(points, { width: 1.3, opacity: .36, color: '#3c4a3f' });
    });
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 760, y = 222 + rnd() * 36;
      s += stroke([[x, y], [x + r(-3), y + 10 + rnd() * 16]], { width: .9, opacity: .24, color: '#3c4a3f', sketch: false });
    }
    return s;
  }

  function house(x, y, scale) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">`;
    g += wash([[-34, -6], [-34, -30], [34, -30], [34, -6]], { fill: '#a98a5b', opacity: .13 });
    g += stroke([[-36, -30], [-20, -48], [20, -48], [36, -30]], { width: 1.8 });
    g += stroke([[-41, -30], [-30, -29]], { width: 1.4 });
    g += stroke([[30, -29], [41, -30]], { width: 1.4 });
    g += stroke([[-32, -24], [-32, -4], [32, -4], [32, -24]], { width: 1.1 });
    g += stroke([[-28, -4], [-30, 26]], { width: 1.3 });
    g += stroke([[-8, -4], [-8, 26]], { width: 1.2 });
    g += stroke([[12, -4], [12, 26]], { width: 1.2 });
    g += stroke([[30, -4], [32, 26]], { width: 1.3 });
    g += stroke([[-41, -2], [-32, 26]], { width: 1 });
    for (let i = 0; i < 4; i++) g += stroke([[-39 + i * 2, 4 + i * 6], [-33 + i * 2, 3 + i * 6]], { width: .8, opacity: .6, sketch: false });
    g += stroke([[-6, -24], [-6, -4], [8, -4], [8, -24]], { width: .9, opacity: .6 });
    g += '</g>';
    return g;
  }

  function tree(x, y, scale) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">`;
    g += stroke([[0, 0], [-2, -18], [2, -34]], { width: 1.8 });
    g += wash([[-20, -40], [0, -56], [20, -40], [12, -26], [-12, -26]], { fill: '#4b604c', opacity: .12 });
    g += stroke([[-18, -34], [-8, -44], [4, -46], [16, -36]], { width: 1.1, opacity: .6 });
    g += stroke([[-14, -28], [0, -38], [14, -28]], { width: 1, opacity: .5 });
    g += '</g>';
    return g;
  }

  function boat(x, y, scale) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">`;
    g += stroke([[-46, 0], [-30, 12], [28, 12], [46, 0]], { width: 1.6 });
    g += stroke([[-46, 0], [46, 0]], { width: 1.1, opacity: .6 });
    g += person(0, -2, .55, 'stand', false);
    g += stroke([[6, -20], [22, -52], [34, -58]], { width: 1.2 });
    g += stroke([[-20, 14], [-10, 16], [8, 15], [22, 13]], { width: .8, opacity: .4, sketch: false });
    g += '</g>';
    return g;
  }

  function fields(x, y, rows) {
    let g = `<g transform="translate(${n(x)} ${n(y)})">`;
    for (let i = 0; i < (rows || 4); i++) {
      const yy = i * 22;
      g += stroke([[0, yy], [156, yy - 6]], { width: .9, opacity: .5 });
      g += stroke([[0, yy], [156, yy + 16]], { width: .9, opacity: .4 });
      for (let j = 1; j < 9; j++) g += stroke([[j * 17, yy + 1], [j * 17 - 4, yy + 15]], { width: .6, opacity: .28, sketch: false });
    }
    for (let j = 1; j < 3; j++) g += stroke([[j * 52, -2], [j * 52, (rows || 4) * 22 + 10]], { width: .8, opacity: .35 });
    g += '</g>';
    return g;
  }

  function panelLandscape() {
    let s = '<rect x="0" y="0" width="760" height="520" fill="url(#intro-sky)"/>';
    s += `<circle cx="640" cy="86" r="30" fill="${CINNABAR}" fill-opacity=".16" stroke="${CINNABAR}" stroke-opacity=".5" stroke-width="1.2"/>`;
    [[560, 112], [598, 100], [664, 122]].forEach(([x, y]) => { s += stroke([[x, y], [x + 16, y - 4], [x + 34, y + 1], [x + 20, y + 4]], { width: .8, opacity: .28, sketch: false }); });
    s += mountains();
    s += stroke([[0, 316], [140, 310], [300, 318], [430, 312], [560, 318], [760, 310]], { width: .9, opacity: .35 });
    s += wash([[0, 314], [760, 308], [760, 412], [0, 416]], { fill: '#4e6a58', opacity: .12 });
    for (let i = 0; i < 44; i++) {
      const x = 18 + rnd() * 700, y = 322 + rnd() * 86, w = 16 + rnd() * 34;
      s += stroke([[x, y], [x + w, y + r(.6)]], { width: .7 + rnd() * .6, opacity: .16 + rnd() * .26, color: '#3d5648', wobble: .5, sketch: false });
    }
    s += boat(320, 352, 1);
    s += wash([[0, 414], [180, 408], [360, 420], [540, 410], [760, 418], [760, 520], [0, 520]], { fill: '#b09666', opacity: .16 });
    s += stroke([[0, 414], [120, 408], [260, 418], [380, 414], [520, 406], [640, 416], [760, 410]], { width: 1.3, opacity: .5 });
    for (let i = 0; i < 26; i++) {
      const x = 24 + rnd() * 700, y = 420 + rnd() * 94;
      s += stroke([[x, y], [x + 6, y + 3]], { width: .7, opacity: .2, sketch: false });
    }
    s += fields(452, 424, 3);
    s += house(104, 430, 1.02);
    s += house(196, 438, .78);
    s += house(268, 442, .58);
    s += tree(42, 436, 1);
    s += tree(332, 440, .72);
    [[296, 462, .5, 'stand', false], [326, 466, .46, 'kneel', false], [366, 460, .44, 'stand', true], [610, 456, .5, 'stand', false]].forEach(p => { s += person(p[0], p[1], p[2], p[3], p[4]); });
    [[520, 120], [548, 136], [576, 118], [500, 152]].forEach(([x, y]) => { s += stroke([[x - 7, y], [x, y - 4], [x + 7, y]], { width: .9, opacity: .5, sketch: false }); });
    [[70, 412], [84, 414], [98, 411], [676, 418], [690, 415]].forEach(([x, y]) => { s += stroke([[x, y], [x + 2, y - 18], [x + 6, y - 22]], { width: .8, opacity: .38, sketch: false }); });
    s += seal(64, 96, 42, '滇');
    return s;
  }

  function panelLidView() {
    let s = `<ellipse cx="380" cy="268" rx="344" ry="238" fill="#b39a6b" fill-opacity=".05"/>`;
    s += lidRing(380, 262, 252, 170, { scale: .52, showEars: false });
    s += stroke([[64, 486], [210, 492], [380, 494], [548, 492], [696, 486]], { width: 1, opacity: .28, sketch: false });
    for (let i = 0; i < 10; i++) {
      const x = 70 + rnd() * 620;
      s += stroke([[x, 490 + rnd() * 12], [x + 12, 488 + rnd() * 12]], { width: .6, opacity: .16, sketch: false });
    }
    return s;
  }

  function panelCenter() {
    const arcY = t => (1 - t) * (1 - t) * 470 + 2 * (1 - t) * t * (-50) + t * t * 470;
    let s = `<path d="M30 470 Q380 -50 730 470" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".2"/>`;
    s += `<path d="M72 470 Q380 12 688 470" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".18"/>`;
    // 器盖边缘的短刻线，让弧线读作盖沿而非山脊。
    for (let i = 0; i <= 46; i++) {
      const t = i / 46, x = 30 + 700 * t, y = arcY(t);
      s += stroke([[x, y], [x + (380 - x) * .012, y + 7]], { width: .5, opacity: .2, sketch: false });
    }
    // 七组环列于器盖远缘。
    for (let i = 0; i < 7; i++) {
      const t = .13 + i * .123;
      const x = 30 + 700 * t, y = arcY(t) - 6;
      s += person(x, y, .32, 'stand', false);
      s += horse(x + 16, y + 1, .32, false);
      s += stroke([[x + 2, y - 12], [x + 12, y - 18], [x + 24, y - 18]], { width: .7, opacity: .4, sketch: false });
    }
    // 地面与散落草屑。
    s += stroke([[40, 470], [720, 464]], { width: 1.3, opacity: .32 });
    for (let i = 0; i < 12; i++) {
      const x = 60 + rnd() * 620, y = 474 + rnd() * 12;
      s += stroke([[x, y], [x + 9, y + 2]], { width: .6, opacity: .18, sketch: false });
    }
    // 铜鼓上的头领。
    s += drum(330, 431, 1.55);
    s += seatedChief(332, 432, 1.8, false);
    s += wash([[329, 408], [335, 405], [323, 449], [316, 447]], { fill: INK, opacity: .1, stroke: true, width: 1 });
    s += stroke([[330, 402], [336, 410]], { width: 1.5 });
    s += `<circle cx="329" cy="402" r="1.6" fill="${INK}" fill-opacity=".6"/>`;
    // 执伞者；伞盖已缺，只余弯杆、断口与垂下的残缯。
    s += person(218, 470, 1, 'stand', false);
    s += stroke([[228, 440], [221, 330], [217, 238]], { width: 1.5 });
    s += stroke([[217, 238], [222, 229], [214, 222], [218, 213]], { width: 1.4 });
    s += stroke([[218, 213], [209, 221], [212, 231]], { width: .8, opacity: .5 });
    // 跪地受斥者。
    s += person(508, 470, 1.15, 'kneel', true);
    s += stroke([[378, 372], [470, 424]], { width: .8, opacity: .32, sketch: false });
    s += seal(650, 112, 44, '驯');
    return s;
  }

  function vesselMini(x, y, scale) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">`;
    g += `<path d="M-30 0 C-34 -20 -34 -44 -30 -58 L30 -58 C34 -44 34 -20 30 0 Z" fill="#cdb07a" fill-opacity=".25" stroke="${INK}" stroke-width="1.4"/>`;
    g += `<ellipse cx="0" cy="-58" rx="30" ry="7" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
    g += stroke([[-30, -34], [30, -34]], { width: .9, opacity: .5 });
    g += stroke([[-24, 2], [-28, 12]], { width: 1.1 });
    g += stroke([[24, 2], [28, 12]], { width: 1.1 });
    g += '</g>';
    return g;
  }

  function bell(x, y, scale) {
    let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">`;
    g += stroke([[-10, 0], [-10, -8], [-14, -12], [-16, -32], [-6, -40], [6, -40], [16, -32], [14, -12], [10, -8], [10, 0]], { width: 1.2 });
    g += stroke([[-16, -32], [16, -32]], { width: .8, opacity: .5 });
    g += stroke([[0, -40], [0, -46]], { width: 1 });
    g += '</g>';
    return g;
  }

  function panelVessel() {
    let s = wash([[40, 452], [120, 422], [640, 420], [720, 450], [720, 474], [40, 474]], { fill: '#7b6644', opacity: .1 });
    const body = 'M262 206 C252 250 250 304 266 350 C282 394 322 410 380 410 C438 410 478 394 494 350 C510 304 508 250 498 206';
    s += `<path d="${body}" fill="#c9a15e" fill-opacity=".09" stroke="none"/>`;
    s += `<path d="${body}" fill="none" stroke="${INK}" stroke-width="2" stroke-opacity=".85"/>`;
    s += `<ellipse cx="380" cy="206" rx="118" ry="22" fill="${PAPER}" fill-opacity=".5" stroke="${INK}" stroke-width="1.8" stroke-opacity=".85"/>`;
    s += `<ellipse cx="380" cy="206" rx="100" ry="15" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".45"/>`;
    s += `<ellipse cx="380" cy="201" rx="88" ry="13" fill="none" stroke="${INK}" stroke-width=".9" stroke-opacity=".38"/>`;
    s += `<ellipse cx="380" cy="198" rx="52" ry="8" fill="none" stroke="${INK}" stroke-width=".8" stroke-opacity=".28"/>`;
    [252, 300, 344].forEach((y, i) => {
      const half = 124 - i * 2;
      s += stroke([[380 - half, y], [380, y + 5], [380 + half, y]], { width: 1.1, opacity: .5 });
      for (let x = -half + 20; x < half - 10; x += 22) {
        s += stroke([[380 + x, y + 1], [380 + x + 8, y + 12], [380 + x + 16, y + 1]], { width: .7, opacity: .32, sketch: false });
      }
    });
    [[300, 408], [380, 412], [460, 408]].forEach(([x, y]) => {
      s += wash([[x - 16, y], [x + 16, y], [x + 20, y + 40], [x - 20, y + 40]], { fill: '#7d6337', opacity: .16, stroke: true, width: 1.3 });
    });
    s += tigerEar(246, 288, 1.2, false);
    s += tigerEar(514, 288, 1.2, true);
    for (let i = 0; i < 11; i++) s += cowrie(116 + i * 52 + r(8), 448 + r(12), .8 + rnd() * .4, r(24));
    s += seal(84, 118, 44, '贝');
    return s;
  }

  function panelTomb() {
    let s = '<rect width="760" height="520" fill="#e7d9ba" fill-opacity=".35"/>';
    for (let i = 0; i < 34; i++) s += `<circle cx="${n(rnd() * 760)}" cy="${n(20 + rnd() * 140)}" r="${n(.7 + rnd() * 1.1)}" fill="${INK}" fill-opacity="${n(.22 + rnd() * .4, 2)}"/>`;
    s += `<circle cx="642" cy="82" r="33" fill="${PAPER}" fill-opacity=".45" stroke="${INK}" stroke-width="1.2" stroke-opacity=".55"/>`;
    // 封土与墓丘。
    s += wash([[52, 392], [118, 300], [238, 196], [388, 168], [534, 212], [650, 300], [710, 392]], { fill: '#7b855f', opacity: .15, stroke: true, width: 1.6 });
    s += wash([[82, 392], [150, 322], [388, 226], [620, 320], [684, 392]], { fill: '#5f6c4b', opacity: .07 });
    s += `<path d="M104 344 Q380 128 662 344" fill="none" stroke="${INK}" stroke-width=".8" stroke-opacity=".16"/>`;
    s += `<path d="M140 368 Q380 180 624 368" fill="none" stroke="${INK}" stroke-width=".7" stroke-opacity=".13"/>`;
    for (let i = 0; i < 22; i++) {
      const x = 120 + rnd() * 500, y = 236 + rnd() * 120;
      s += stroke([[x, y], [x + r(7), y + 14 + rnd() * 16]], { width: .8, opacity: .2, color: '#4f5a3c', sketch: false });
    }
    for (let i = 0; i < 16; i++) {
      const x = 90 + rnd() * 590, y = 386 + r(6);
      s += stroke([[x, y], [x - 2, y - 8], [x + 1, y - 13]], { width: .7, opacity: .3, color: '#4f5a3c', sketch: false });
      s += stroke([[x + 2, y], [x + 5, y - 9]], { width: .6, opacity: .25, color: '#4f5a3c', sketch: false });
    }
    s += stroke([[30, 392], [730, 392]], { width: 1.7, opacity: .65 });
    // 墓口与一束天光。
    s += `<ellipse cx="380" cy="198" rx="22" ry="6" fill="#3b3126" fill-opacity=".18" stroke="none"/>`;
    s += `<path d="M356 206 L404 206 L448 330 L312 330 Z" fill="url(#intro-beam)" stroke="none"/>`;
    s += `<path d="M356 206 L312 330 M404 206 L448 330" fill="none" stroke="${INK}" stroke-width=".7" stroke-opacity=".14"/>`;
    // 墓室剖面：随葬品仍在地层之中。
    s += `<path d="M282 392 V334 Q298 306 380 306 Q462 306 478 334 V392 Z" fill="${PAPER}" fill-opacity=".62" stroke="${INK}" stroke-width="1.4" stroke-opacity=".62"/>`;
    s += vesselMini(340, 386, .9);
    s += bell(406, 386, .95);
    s += bell(430, 386, .95);
    s += bell(454, 386, .95);
    s += person(492, 386, .6, 'stand', true);
    s += stroke([[494, 362], [498, 322]], { width: .8, opacity: .55 });
    s += `<path d="M352 306 L404 306 L426 384 L330 384 Z" fill="url(#intro-beam)" stroke="none" opacity=".8"/>`;
    s += `<ellipse cx="352" cy="352" rx="40" ry="19" fill="#e8c87a" fill-opacity=".22" stroke="none"/>`;
    for (let i = 0; i < 12; i++) s += `<circle cx="${n(340 + rnd() * 88)}" cy="${n(212 + rnd() * 108)}" r="${n(.6 + rnd() * 1)}" fill="${INK}" fill-opacity=".2"/>`;
    // 地层与根须。
    for (let i = 0; i < 6; i++) {
      const y = 404 + i * 19;
      s += stroke([[36 + r(6), y], [260, y + r(2)]], { width: .7, opacity: .2, sketch: false });
      s += stroke([[522, y + r(2)], [724 + r(6), y]], { width: .7, opacity: .2, sketch: false });
    }
    [[156, 392], [640, 392]].forEach(([x, y]) => { s += stroke([[x, y], [x + r(10), y + 40], [x + r(16), y + 78]], { width: .9, opacity: .3 }); });
    s += seal(78, 178, 44, '墓');
    return s;
  }

  function panelRevive() {
    let s = lidRing(360, 250, 232, 152, { scale: .46, highlight: 0, showEars: false, showSeal: false });
    // 第一组缰绳沿器盖外缘滑出，渐细，末尾打一个松结垂向画外。
    s += stroke([[398, 138], [474, 134], [536, 166], [578, 214], [606, 272]], { width: 1.5, opacity: .55 });
    s += stroke([[606, 272], [618, 334], [630, 396], [654, 446]], { width: 1.1, opacity: .5 });
    s += stroke([[404, 146], [478, 142], [540, 174], [582, 222], [610, 280]], { width: .55, opacity: .22, sketch: false });
    s += stroke([[654, 446], [672, 468], [690, 472], [700, 460], [694, 448], [683, 452], [684, 462], [692, 464]], { width: 1.2, opacity: .5 });
    [[474, 134], [578, 214], [618, 334], [642, 420]].forEach(([x, y], i) => { s += `<circle cx="${x}" cy="${y}" r="${n(2.3 - i * .35)}" fill="${INK}" fill-opacity=".3"/>`; });
    s += seal(636, 112, 46, '始');
    return s;
  }

  const panels = {
    landscape: panelLandscape,
    lid: panelLidView,
    center: panelCenter,
    vessel: panelVessel,
    tomb: panelTomb,
    revive: panelRevive
  };

  function renderPanel(kind, label) {
    rnd = seeded(seedOf(kind));
    const body = (panels[kind] || panelLidView)();
    return `<svg class="intro-panel" viewBox="0 0 760 520" role="img" aria-label="${escapeHtml(label || '古画风格分镜')}">` +
      DEFS + `<g filter="url(#intro-rough)">${body}</g></svg>`;
  }

  const state = { active: false, index: 0 };
  let dom = null;
  let narrator = null;
  const narrationText = scene => scene.title + '。' + scene.lines.join('');
  function narrationPlayer() {
    if (!narrator && root.GameVoice) narrator = root.GameVoice.createPlayer(root, root.IntroAudio || {});
    return narrator;
  }
  function syncNarrationSettings() {
    const voice = narrationPlayer();
    if (!voice) return null;
    voice.setEnabled(root.GameAudio?.enabled !== false);
    voice.setVolume(root.GameAudio?.sfxVolume ?? 1);
    return voice;
  }
  function updateAudio() {
    const voice = syncNarrationSettings();
    if (!voice || !dom) return;
    if (!state.active) { voice.stop(); return; }
    const write = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
    if (dom.voiceArea) dom.voiceArea.hidden = !voice.available;
    const enabled = root.GameAudio?.enabled !== false;
    write(dom.voiceStatus, !enabled ? 'AI旁白已静音' : voice.error ? '馆长AI旁白 · 点播放' : voice.playing ? '馆长AI旁白 · 讲述中' : '馆长AI旁白');
    if (dom.voiceToggle) { write(dom.voiceToggle, voice.playing ? '暂停' : '播放'); dom.voiceToggle.setAttribute('aria-label', voice.playing ? '暂停开场旁白' : '播放开场旁白'); }
    if (dom.voiceMute) { write(dom.voiceMute, enabled ? '静音' : '开声音'); dom.voiceMute.setAttribute('aria-pressed', String(!enabled)); }
    const clock = value => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
    write(dom.voiceTime, `${clock(voice.elapsed)} / ${clock(voice.duration)}`);
    if (dom.voiceProgress) { dom.voiceProgress.max = voice.duration || 1; dom.voiceProgress.value = voice.elapsed; }
  }
  function voiceAction(action) {
    const voice = narrationPlayer();
    if (!voice) return;
    root.GameAudio?.unlock?.();
    if (action === 'voice-mute' || root.GameAudio?.enabled === false) {
      root.GameAudio?.toggle?.();
      root.GameCore?.save?.setSetting('sound', root.GameAudio.enabled);
    }
    syncNarrationSettings();
    if (action === 'voice-toggle') voice.playing ? voice.pause() : voice.resume();
    else if (action === 'voice-replay') voice.replay();
    updateAudio();
  }

  function initDom() {
    if (dom) return dom;
    const section = document.getElementById('intro-cinema');
    if (!section) return null;
    dom = {
      section,
      art: section.querySelector('#intro-art'),
      caption: section.querySelector('#intro-caption'),
      chapter: section.querySelector('#intro-chapter'),
      title: section.querySelector('#intro-title'),
      lines: section.querySelector('#intro-lines'),
      foot: section.querySelector('#intro-foot'),
      dots: section.querySelector('#intro-dots'),
      next: section.querySelector('[data-intro="next"]'),
      prev: section.querySelector('[data-intro="prev"]'),
      counter: section.querySelector('#intro-counter'),
      voiceArea: section.querySelector('#intro-narration'),
      voiceStatus: section.querySelector('#intro-voice-status'),
      voiceToggle: section.querySelector('[data-intro="voice-toggle"]'),
      voiceMute: section.querySelector('[data-intro="voice-mute"]'),
      voiceTime: section.querySelector('#intro-voice-time'),
      voiceProgress: section.querySelector('#intro-voice-progress')
    };
    dom.dots.innerHTML = scenes.map((scene, index) =>
      `<button type="button" data-intro="go" data-index="${index}" aria-label="第 ${index + 1} 页：${escapeHtml(scene.title)}"><i></i></button>`
    ).join('');
    section.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    return dom;
  }

  function render(index) {
    const safe = Math.max(0, Math.min(scenes.length - 1, Number(index) || 0));
    const scene = scenes[safe];
    dom = dom || initDom();
    if (!dom) return;
    state.index = safe;
    if (state.active) { const voice = syncNarrationSettings(); if (voice) voice.select(narrationText(scene)); }
    dom.section.setAttribute('aria-label', `前情提要 · 第 ${safe + 1} 页：${scene.title}`);
    dom.art.innerHTML = renderPanel(scene.art, scene.label);
    dom.art.classList.remove('ink-in');
    void dom.art.offsetWidth;
    dom.art.classList.add('ink-in');
    dom.caption.textContent = scene.caption;
    dom.chapter.textContent = scene.numeral;
    dom.title.textContent = scene.title;
    dom.lines.innerHTML = scene.lines.map((line, i) => {
      const quote = line.startsWith('「') ? ' class="quote"' : '';
      return `<p${quote} style="--i:${i}">${escapeHtml(line)}</p>`;
    }).join('');
    dom.foot.textContent = scene.source;
    dom.next.innerHTML = safe === scenes.length - 1 ? '进入器盖 · 开始 <kbd>空格 / A</kbd>' : '继续 <kbd>空格 / A</kbd>';
    dom.prev.disabled = safe === 0;
    dom.counter.textContent = `${String(safe + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    const dots = dom.dots.querySelectorAll('button');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === safe);
      dot.setAttribute('aria-current', i === safe ? 'page' : 'false');
    });
    updateAudio();
  }

  function play(cue) {
    if (root.GameAudio && typeof root.GameAudio.play === 'function') {
      try { root.GameAudio.play(cue); } catch (_) { /* 声音失败不影响翻页 */ }
    }
  }

  function next() {
    if (!state.active) return;
    if (state.index >= scenes.length - 1) { finish(); return; }
    play('ui');
    render(state.index + 1);
  }

  function prev() {
    if (!state.active || state.index <= 0) return;
    play('ui');
    render(state.index - 1);
  }

  function onKey(event) {
    if (!state.active) return;
    if (!['Space', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight', 'KeyV', 'KeyR'].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    const control = event.target?.closest?.('[data-intro^="voice-"]');
    if (control && ['Space', 'Enter'].includes(event.code)) { voiceAction(control.dataset.intro); return; }
    key(event.code);
  }

  // 键盘与手柄共用：空格 / A 继续，Esc 略过，方向与 B 翻页。
  function key(code) {
    if (!state.active) return false;
    if (code === 'KeyV') { voiceAction('voice-toggle'); return true; }
    if (code === 'KeyR') { voiceAction('voice-replay'); return true; }
    if (code === 'Escape') { finish(); return true; }
    if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'ShiftLeft' || code === 'ShiftRight') { prev(); return true; }
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'Space' || code === 'Enter') { next(); return true; }
    return true;
  }

  function onClick(event) {
    if (!state.active) return;
    const trigger = event.target.closest('[data-intro]');
    if (!trigger) return;
    const action = trigger.dataset.intro;
    if (action.startsWith('voice-')) { voiceAction(action); return; }
    if (action === 'next') next();
    else if (action === 'prev') prev();
    else if (action === 'skip') finish();
    else if (action === 'go') { play('ui'); render(Number(trigger.dataset.index)); }
  }

  function start(index) {
    if (!initDom()) return;
    if (state.active && state.index === index) { render(index || 0); return; }
    state.active = true;
    root.CuratorVoice?.stop();
    dom.section.classList.remove('hidden');
    dom.section.setAttribute('aria-hidden', 'false');
    document.body.classList.add('intro-open');
    if (root.GameAudio && typeof root.GameAudio.unlock === 'function') {
      try { root.GameAudio.unlock(); } catch (_) { /* 静音环境仍可阅读 */ }
    }
    render(index || 0);
    requestAnimationFrame(() => { if (dom.next) dom.next.focus({ preventScroll: true }); });
  }

  function finish() {
    if (!state.active || !dom) return;
    state.active = false;
    narrator?.stop();
    dom.section.classList.add('hidden');
    dom.section.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('intro-open');
    play('ui');
    const first = document.querySelector('#title-screen [data-act="difficulty"]');
    if (first) first.focus({ preventScroll: true });
  }

  const api = { scenes, renderPanel, narrationText, updateAudio, start, finish, next, prev, key, get active() { return state.active; }, get index() { return state.index; }, get speaking() { return state.active && !!narrator?.playing; } };
  root.GameIntro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(0));
    else start(0);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
