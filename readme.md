## 屏幕刷新率 & 帧

### 屏幕刷新率

- 目前大多数设备的屏幕刷新率为 60 次/秒
- 浏览器渲染动画或页面的每一帧的速率也需要跟设备屏幕的刷新率保持一致
- 页面是一帧一帧绘制出来的，当每秒绘制的帧数（FPS）达到 60 时，页面是流畅的,小于这个值时，用户会感觉到卡顿
- 每个帧的预算时间是 16.66 毫秒 (1 秒/60)
- 1s 60 帧，所以每一帧分到的时间是 1000/60 ≈ 16 ms。所以我们书写代码时力求不让一帧的工作量超过 16ms

![img](https://cherish0207.github.io/images/fiber-basic/autogivefood.gif)

### life of frame

- 每个帧的开头包括样式计算、布局和绘制
- 如果某个任务执行时间过长，浏览器会推迟渲染

![img](https://cherish0207.github.io/images/fiber-basic/lifeofframe.png)

- 输入事件：优先级最高，以让用户得到最快反馈
- timers：定时器到时间的回调
- GUI 渲染和 script 引擎是同一个线程，互斥，是性能优化的基础

## 2.1 [rAF](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)

`requestAnimationFrame`回调函数会在绘制之前执行
[github](https://github.com/Cherish0207/fiber-basic/blob/master/1.requestAnimationFrame.html)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RAF</title>
  </head>

  <body>
    <p>在页面上绘制一个进度条值 0% => 100%</p>
    <div
      id="progressBar"
      style="background: lightblue; width: 0; height: 20px"
    ></div>
    <button id="btn">开始</button>
    <script>
      /**
       * requestAnimationFrame(callback) 由浏览器专门为动画提供的API
       * cancelAnimationFrame(返回值) 清除动画
       * <16.7 丢帧
       * >16.7 跳跃 卡顿
       */
      const div = document.querySelector("#progressBar");
      const button = document.querySelector("#btn");
      let start;
      function progress(current) {
        div.style.width = div.offsetWidth + 1 + "px";
        div.innerHTML = div.offsetWidth + "%";
        if (div.offsetWidth < 100) {
          // 打印开始准备执行的时候到真正执行的时间的时间差
          if (start === undefined) start = timestamp;
          console.log(parseInt(current - start));
          start = current;
          requestAnimationFrame(progress);
        }
      }
      button.onclick = () => {
        div.style.width = 0;
        start = Date.now();
        requestAnimationFrame(progress); // progress会在下次渲染前执行
      };
    </script>
  </body>
</html>
```

### 2.2 [requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback)

- 我们希望快速响应用户，让用户觉得够快，不能阻塞用户的交互
- `requestIdleCallback` 使开发者能够在主事件循环上执行后台和低优先级工作，而不会影-响延迟关键事件，如动画和输入响应
- 正常帧任务完成后没超过 16ms,说明时间有富余，此时就会执行 `requestIdleCallback` 里注册的任务

![img](https://cherish0207.github.io/images/fiber-basic/cooperativescheduling2.png)

```ts
window.requestIdleCallback(
  callback: (deaLine: IdleDeadline) => void,
  option?: {timeout: number}
  )

interface IdleDeadline {
  didTimeout: boolean // 表示任务执行是否超过约定时间
  timeRemaining(): DOMHighResTimeStamp // 任务可供执行的剩余时间
}
```

- callback：回调即空闲时需要执行的任务，该回调函数接收一个 IdleDeadline 对象作为入参。其中 IdleDeadline 对象包含：
  - didTimeout，布尔值，表示任务是否超时，结合 timeRemaining 使用
  - timeRemaining()，表示当前帧剩余的时间，也可理解为留给任务的时间还有多少
- options：目前 options 只有一个参数
  - timeout。表示超过这个时间后，如果任务还没执行，则强制执行，不必等待空闲

[github](https://github.com/Cherish0207/fiber-basic/blob/master/2.requestIdleCallback.html)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>requestIdleCallback</title>
  </head>
  <body>
    <script>
      // 在js里实现睡眠功能
      function sleep(delay) {
        for (var t = Date.now(); Date.now() - t <= delay; );
      }
      // 一个个小任务
      const works = [
        () => {
          logger("第1个任务开始");
          sleep(8);
          logger("第1个任务结束");
        },
        () => {
          logger("第2个任务开始");
          sleep(1000); // 一帧16.6ms，因为此任务的执行时间已经超过了16.6ms,所需要把控制权交给浏览器
          // 剩余时间没执行完requestIdleCallback，则会卡在这里
          logger("第2个任务结束");
        },
        () => {
          logger("第3个任务开始");
          sleep(5);
          logger("第3个任务结束");
        },
      ];
      // 每次取出一个任务执行
      function performUnitOfWork() {
        works.shift()();
      }
      function logger(content) {
        console.log(content);
      }
      /**
       * deadline: {timeRemaining, didTimeout}
       * timeRemaining(): 返回此帧还剩多少时间供用户使用
       * didTimeout: 此callback任务是否超时
       */
      function workLoop(deadline) {
        logger(`本帧剩余${parseInt(deadline.timeRemaining())}ms`); // 一般是个小于16ms的值
        while (
          (deadline.timeRemaining() > 1 || deadline.didTimeout) &&
          works.length > 0
        ) {
          logger(`还剩${parseInt(deadline.timeRemaining())}ms`);
          performUnitOfWork();
          logger(`还剩${parseInt(deadline.timeRemaining())}ms`);
        }
        // 如果没有剩余时间了,就放弃执行任务控制权,执行权交还给浏览器
        if (works.length > 0) {
          logger(
            `还剩${parseInt(
              deadline.timeRemaining()
            )}ms,时间片到了,等待下次空闲时间的调度`
          );
          requestIdleCallback(workLoop);
        }
      }
      /**
       * 取出workLoop任务执行
       * 这是一个全局属性/方法
       * 我作为用户,告诉浏览器,我现在执行callback函数,但是它的优先级比较低,可以在空闲的时候执行callback
       * timeout: 500: 但是如果到了timeout超时时间了,即使没有空闲时间也得执行，必须马上执行
       */
      requestIdleCallback(workLoop, { timeout: 500 });
    </script>
  </body>
</html>
```

ps:

- 不要在空闲时间 idle 操作 dom，引起重新渲染
- 这个调度方式叫合作式调度,需要浏览器相信用户写的代码
  但是如果用户写代码时,或者执行时间超过给的剩余时间,浏览器没有办法

### 2.3 MessageChannel

- 目前 requestIdleCallback 目前只有 Chrome 支持
- 所以目前 React 利用 MessageChannel 模拟了 requestIdleCallback，将回调延迟到绘制操作之后执行
- MessageChannel API 允许我们创建一个新的消息通道，并通过它的两个 MessagePort 属性发送数据
- MessageChannel 创建了一个通信的管道，这个管道有两个端口，每个端口都可以通过 postMessage 发送数据，而一个端口只要绑定了 onmessage 回调方法，就可以接收从另一个端口传过来的数据
- MessageChannel 是一个宏任务

![img](https://cherish0207.github.io/images/fiber-basic/phones.png)

```js
var channel = new MessageChannel();
//channel.port1
//channel.port2
```

```js
var channel = new MessageChannel();
var port1 = channel.port1;
var port2 = channel.port2;
port1.onmessage = function (event) {
  console.log("port1收到来自port2的数据：" + event.data);
};
port2.onmessage = function (event) {
  console.log("port2收到来自port1的数据：" + event.data);
};
port1.postMessage("发送给port2");
port2.postMessage("发送给port1");
```

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>

  <body>
    <script>
      const channel = new MessageChannel();
      let pendingCallback;
      let startTime;
      let timeoutTime;
      let perFrameTime = 1000 / 60;
      let timeRemaining = () => perFrameTime - (Date.now() - startTime);
      channel.port2.onmessage = () => {
        if (pendingCallback) {
          pendingCallback({
            didTimeout: Date.now() > timeoutTime,
            timeRemaining,
          });
        }
      };
      window.requestIdleCallback = (callback, options) => {
        timeoutTime = Date.now() + options.timeout;
        requestAnimationFrame(() => {
          startTime = Date.now();
          pendingCallback = callback;
          channel.port1.postMessage("hello");
        });
        /* startTime = Date.now();
            setTimeout(() => {
                callback({ didTimeout: Date.now() > timeoutTime, timeRemaining });
            }); */
      };

      function sleep(d) {
        for (var t = Date.now(); Date.now() - t <= d; );
      }
      const works = [
        () => {
          console.log("第1个任务开始");
          sleep(30); //sleep(20);
          console.log("第1个任务结束");
        },
        () => {
          console.log("第2个任务开始");
          sleep(30); //sleep(20);
          console.log("第2个任务结束");
        },
        () => {
          console.log("第3个任务开始");
          sleep(30); //sleep(20);
          console.log("第3个任务结束");
        },
      ];

      requestIdleCallback(workLoop, { timeout: 60 * 1000 });
      function workLoop(deadline) {
        console.log("本帧剩余时间", parseInt(deadline.timeRemaining()));
        while (
          (deadline.timeRemaining() > 1 || deadline.didTimeout) &&
          works.length > 0
        ) {
          performUnitOfWork();
        }
        if (works.length > 0) {
          console.log(
            `只剩下${parseInt(
              deadline.timeRemaining()
            )}ms,时间片到了等待下次空闲时间的调度`
          );
          requestIdleCallback(workLoop, { timeout: 60 * 1000 });
        }
      }
      function performUnitOfWork() {
        works.shift()();
      }
    </script>
  </body>
</html>
```

### 2.4 单链表

- 单链表是一种链式存取的数据结构
- 链表中的数据是以节点来表示的，每个节点的构成：元素 + 指针(指示后继元素存储位置)，元素就是存储数据的存储单元，指针就是连接每个节点的地址

![img](https://cherish0207.github.io/images/fiber-basic/trainlist.png)
![img](https://cherish0207.github.io/images/fiber-basic/singlelink2.png)

[github](https://github.com/Cherish0207/fiber-basic/blob/master/4.单链表.js)

```js
class Update {
  constructor(payload, nextUpdate) {
    this.payload = payload;
    this.nextUpdate = nextUpdate;
  }
}
class UpdateQueue {
  constructor() {
    this.baseState = null;
    this.firstUpdate = null;
    this.lastUpdate = null;
  }
  clear() {
    this.firstUpdate = null;
    this.lastUpdate = null;
  }
  enqueueUpdate(update) {
    if (this.firstUpdate === null) {
      this.firstUpdate = this.lastUpdate = update;
    } else {
      this.lastUpdate.nextUpdate = update;
      this.lastUpdate = update;
    }
  }
  forceUpdate() {
    let currentState = this.baseState || {};
    let currentUpdate = this.firstUpdate;
    while (currentUpdate) {
      let nexState =
        typeof currentUpdate.payload == "function"
          ? currentUpdate.payload(currentState)
          : currentUpdate.payload;
      currentState = { ...currentState, ...nexState };
      currentUpdate = currentUpdate.nextUpdate;
    }
    this.firstUpdate = this.lastUpdate = null;
    this.baseState = currentState;
    return currentState;
  }
}
let queue = new UpdateQueue();
queue.enqueueUpdate(new Update({ name: "zhufeng" }));
queue.enqueueUpdate(new Update({ number: 0 }));
queue.enqueueUpdate(new Update((state) => ({ number: state.number + 1 })));
queue.enqueueUpdate(new Update((state) => ({ number: state.number + 1 })));
queue.forceUpdate();
console.log(queue.baseState);
```

## 3.Fiber 历史

### 3.1 Fiber 之前的协调

- React 会递归比对 VirtualDOM 树，找出需要变动的节点，然后同步更新它们。这个过程 React 称为 Reconcilation(协调)。
- 在 Reconcilation 期间，React 会一直占用着浏览器资源，一则会导致用户触发的事件得不到响应, 二则会导致掉帧，用户可能会感觉到卡顿。

[github](https://github.com/Cherish0207/fiber-basic/blob/master/5.Fiber前的深度递归遍历.js)
```js
// fiber 之前是什么样的?为什么需要 fiber?
let root = {
  key: "A1",
  children: [
    {
      key: "B1",
      children: [
        {
          key: "C1",
          children: [],
        },
        {
          key: "C2",
          children: [],
        },
      ],
    },
    {
      key: "B2",
      children: [],
    },
  ],
};
function walk(element) {
  doWork(element);
  element.children.forEach(walk);
}

function doWork(element) {
  console.log(element.key);
}
walk(root);
/**
 * 遍历完一个子节点后，如果先遍历兄弟节点-->广度,如果先遍历子节点-->深度
 * A1 B1 C1 C2 B2
 *
 *  这种遍历递归调用,
 * 1.执行栈会越来越深
 * 2.而且不能中断,因为中断后再想恢复就非常难了
 */
```
