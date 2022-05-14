import {nextTick} from "../utils";

let queue = []; // 这里存放要更新的watcher
let has = {}; // 用来存储已有的watcher的id

let pending = false;

function flushSchedulerQueue() {
  // beforeCreated
  queue.forEach(watcher => watcher.run());
  queue = [];
  has = [];
  pending = [];
}

export function queueWatcher(watcher) {
  // 一般情况下，写去重，可以采用这种方式，如果你不使用set的时候
  let id = watcher.id;
  if (has[id] == null) {
    has[id] = true;
    queue.push(watcher);
    if (!pending) { // 防抖：多次执行，只走一次
      nextTick(flushSchedulerQueue);
      pending = true;
    }
  }
}
