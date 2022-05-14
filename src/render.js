import {isObject} from "./utils";
import {createElement, createText} from "./vdom";

export function renderMixin(Vue) {
  Vue.prototype._c = function () {  // createElement 创建元素型的节点
    const vm = this;
    return createElement(vm, ...arguments); // 描述虚拟节点是属于那个实例的
  }
  Vue.prototype._v = function (text) {  // 创建文本的虚拟的节点
    const vm = this;
    return createText(vm, text); // 描述虚拟节点是属于那个实例的
  }
  Vue.prototype._s = function (val) {  // JSON.stringify()
    if (isObject(val)) {
      return JSON.stringify(val);
    } else {
      return val;
    }
  }
  Vue.prototype._render = function () {
    const vm = this; // vm中所所有数据 vm.xxx -> vm._data.xxx
    let {render} = vm.$options;
    let vnode = render.call(vm);
    return vnode
  }
}
