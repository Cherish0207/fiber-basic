## 屏幕刷新率 & 帧

### 屏幕刷新率

- 目前大多数设备的屏幕刷新率为 60 次/秒
- 浏览器渲染动画或页面的每一帧的速率也需要跟设备屏幕的刷新率保持一致
- 页面是一帧一帧绘制出来的，当每秒绘制的帧数（FPS）达到 60 时，页面是流畅的,小于这个值时，用户会感觉到卡顿
- 每个帧的预算时间是 16.66 毫秒 (1 秒/60)
- 1s 60 帧，所以每一帧分到的时间是 1000/60 ≈ 16 ms。所以我们书写代码时力求不让一帧的工作量超过 16ms

![img](./images/autogivefood.gif)

### life of frame

- 每个帧的开头包括样式计算、布局和绘制
- 如果某个任务执行时间过长，浏览器会推迟渲染

![img](./images/lifeofframe.png)

- 输入事件：优先级最高，以让用户得到最快反馈
- timers：定时器到时间的回调
- GUI 渲染和 script 引擎是同一个线程，互斥，是性能优化的基础

## 2.1 [rAF](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)

`requestAnimationFrame`回调函数会在绘制之前执行

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
