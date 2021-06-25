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
