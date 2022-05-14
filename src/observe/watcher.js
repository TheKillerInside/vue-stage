import Dep from "./dep";
import {queueWatcher} from "./scheduler";

let id = 0;

class Watcher { // 要把dep放到watcher中
  constructor(vm, fn, cb, options) { // $watch()
    this.vm = vm;
    this.fn = fn;
    this.cb = cb;
    this.options = options
    this.id = id++;
    this.depsId = new Set();
    this.deps = [];
    this.getter = fn; // fn就是页面渲染逻辑
    this.get(); // 表示上来后就做一次初始化
  }

  addDep(dep) {
    let did = dep.id;
    if (!this.depsId.has(did)) {
      this.depsId.add(did);
      this.deps.push(dep); // 做了保存id的功能，并且让watcher记住dep
      dep.addSub(this);
    }
  }

  get() {
    Dep.target = this;  // Dep.target = watcher 利用js单线程，先赋值
    this.getter();  // 页面渲染的逻辑 _update(_render()) vm.name / vm.age 再取值
    Dep.target = null; // 渲染完毕后就将标识清空，只有在渲染的时候才会进行依赖收集
  }

  update() { // 每次更新都会同步调用update方法，我可以将更新的逻辑缓存起来，等会同步更新数据的逻辑执行完毕后依次调用(去重的逻辑)
    queueWatcher(this);
    // 可以做异步更新处理
    // this.get(); // vue.nextTick [fn1 fn2 fn3]
  }

  run() {
    this.get();
  }
}

export default Watcher
