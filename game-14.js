(function (root) {
  'use strict';
  const lines = {
    welcome_title: '你好，小小探索家！我是馆长。先来聊聊，开始游戏后就能用海贝挑道具啦。',
    welcome_first: '你好，小小探索家！我是馆长。驯马、看文物、挑道具，有问题就来找我吧。',
    welcome_complete: '七组人马都归位了！你观察得很仔细。来和我一起看看文物里的小细节吧。',
    welcome_retry: '没关系，我们再试一次！你已经有了进步，我陪你复习收放的小窍门。',
    help_1: '先选一组人马，再开始挑战。看看马头和画面里的收放提示。',
    help_2: '看到“按住收缰”，就按住按钮；看到“松缰”，就松开手。键盘用空格，手柄用A。',
    help_3: '让指针留在绿色区域，进度就会增加。没成功也没关系，可以再试一次！',
    story_1: '这件文物叫“驯马场面铜贮贝器”。先猜猜：器盖上一共有几匹马？',
    story_2: '一共有七匹马！周围每组都是一人牵一马，中间还有三个人。一起找找吧。',
    story_3: '“贮”就是存放。贮贝器用来存放作为钱币的海贝，名字里就藏着用途呢！',
    choose_title: '先开始游戏、和马儿交个朋友吧！收集到海贝后，我再陪你挑道具。',
    choose_complete: '这次挑战已经完成啦！现在可以一起看看图鉴，发现更多文物细节。',
    choose_owned: '道具已经集齐啦！带上它们，继续和马儿练习吧。',
    choose_save: '先把海贝留好，回去和下一匹马试试看。等攒够了，我们再一起挑！',
    insufficient: '海贝还差一点，没关系！再和马儿练习一下，我们慢慢攒。',
    chat_first: '先从第一匹马开始吧。别急着一直按住，看看马头，再试着收紧和松开缰绳。我在这里等你回来！',
    chat_retry: '你已经积累的重试进度会保留。回去先看清绿色区域，再慢慢收放缰绳。我们一次进步一点就好！',
    chat_progress: '你已经让人马重新站回器盖上了！下一匹马的节奏可能不同，先观察，再动手。也可以挑一件帮得上忙的道具。',
    chat_tiger: '双虎试炼已经结束啦，你很勇敢！接下来继续和剩下的马儿交朋友，带上的驯马道具还会帮着你。',
    chat_complete: '七组人马都归位了！今天你既是小小驯马师，也是文物探索家。我们再找找器盖上的细节吧！',
    chat_title: '你可以先和我聊聊文物，也可以做几道小问答。想试试驯马时，回到标题开始游戏，我会陪着你。',
    effect_rope: '如果觉得绿色区域太窄，可以选长缰绳。游戏里它能把稳定区加宽四分之一，让你更容易稳住缰绳。',
    effect_bell: '如果觉得绿色区域跑得太快，可以试试定马铜铃。游戏里它能让稳定区移动慢一些，更容易跟上。',
    effect_gold: '如果想让后面的驯马收获更多，可以选剑鞘金饰。游戏里它会增加基础海贝奖励，但不会直接让马儿更容易驯服。',
    effect_sword: '如果双虎试炼还没开始，可以留意这个剑柄。游戏里它能让每次攻击更有力；已经结束双虎试炼，就不用急着买啦。',
    effect_fish: '如果担心双虎试炼中的生命不够，可以留意这件铜鱼杖头铜饰。游戏里它会增加生命上限，帮助你从容应战。',
    effect_token: '如果后面还有马儿没有归位，可以选圆形金片饰。游戏里每完成一匹马，就多得十枚海贝，还能和剑鞘金饰一起用。',
    effect_owned: '这件道具已经在你的背包里啦，游戏效果已经生效。我们可以看看别的宝贝，或者再聊聊它的文物原型。',
    quiz_horses: '先观察器盖，再猜一猜：周围一共有几匹马？',
    quiz_horses_right: '答对啦，是七匹马！周围七组，每组一人牵一马。你很会观察！',
    quiz_horses_wrong: '再数一数，是七匹马哦！周围每组一人牵一马，中间还有三个人。猜错也没关系，我们一起找。',
    quiz_cowries: '第二题：“贮贝器”这个名字告诉我们，它用来存放什么？',
    quiz_cowries_right: '对啦，存放海贝！海贝曾被当作钱币使用，游戏里的海贝就来自这个线索。',
    quiz_cowries_wrong: '答案是海贝！“贮”就是存放，“贝”说的就是海贝。把名字拆开，就能记住它的用途。',
    quiz_bell: '最后一题：铜铃顶部的小耳朵，能帮人们做什么？',
    quiz_bell_right: '真棒，可以穿绳！铜铃能挂在马颈上装饰、发声。游戏里的减慢效果，是我们创作的玩法哦。',
    quiz_bell_wrong: '这些小耳朵可以穿绳，让铜铃挂在马颈上装饰、发声。至于让马儿慢下来，是游戏里的艺术设定。',
    quiz_done: '三道题都聊完啦！你发现了马匹、海贝和铜铃的小秘密。想再观察一次文物，还是回去和马儿试试？'
  };
  const effects = { rope: '绿色区域变宽，更容易控制。', bell: '绿色区域移动慢一点，更好跟上。', gold: '之后每匹马带回的海贝更多。', sword: '双虎试炼中，每次攻击更有力。', fish: '双虎试炼中，你的生命更多。', token: '之后每匹马额外带回10枚海贝。' };
  const lessons = [lines.help_1, lines.help_2, lines.help_3];
  const stories = [{ text: lines.story_1, exhibit: 'container' }, { text: lines.story_2, exhibit: 'container' }, { text: lines.story_3, exhibit: 'cowrie' }];
  const quizzes = [
    { question: 'quiz_horses', choices: ['五匹', '七匹', '九匹'], answer: 1, right: 'quiz_horses_right', wrong: 'quiz_horses_wrong', exhibit: 'container' },
    { question: 'quiz_cowries', choices: ['海贝', '粮食', '清水'], answer: 0, right: 'quiz_cowries_right', wrong: 'quiz_cowries_wrong', exhibit: 'cowrie' },
    { question: 'quiz_bell', choices: ['装水', '穿绳', '放海贝'], answer: 1, right: 'quiz_bell_right', wrong: 'quiz_bell_wrong', exhibit: 'bell' }
  ];
  function catalogue(entries) {
    const result = { ...lines };
    for (let count = 1; count < 7; count++) result['welcome_' + count] = `欢迎回来！你已经让${count}组人马归位了。想聊文物，还是一起挑道具？`;
    const products = { rope: ['长缰绳', 20], bell: ['定马铜铃', 25], gold: ['剑鞘金饰', 35], sword: ['鎏金蛇头铜剑柄', 65], fish: ['铜鱼杖头铜饰', 55], token: ['圆形金片饰', 45] };
    for (const [id, [name, price]] of Object.entries(products)) {
      result['recommend_' + id] = `可以看看${name}，需要${price}枚海贝。${effects[id]}`;
      const entry = entries.find(entry => entry.id === (id === 'rope' ? 'container' : id));
      if (entry?.purchaseIntro) result['purchase_' + id] = entry.purchaseIntro;
    }
    return result;
  }
  const api = { lines, effects, lessons, stories, quizzes, catalogue };
  root.CuratorDialogue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
