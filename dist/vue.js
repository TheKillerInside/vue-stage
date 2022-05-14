(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Vue = factory());
})(this, (function () { 'use strict';

  const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g; // {{   xxx  }}

  function genProps(attrs) {
    // {key: value, key:value}
    let str = "";

    for (let i = 0; i < attrs.length; i++) {
      let attr = attrs[i];

      if (attr.name === "style") {
        let styles = {};
        attr.value.replace(/([^;:]+):([^;:]+)/g, function () {
          styles[arguments[1]] = arguments[2];
        });
        attr.value = styles;
      }

      str += `${attr.name}:${JSON.stringify(attr.value)},`;
    }

    return `{${str.slice(0, -1)}}`;
  }

  function gen(el) {
    if (el.type === 1) {
      return generate(el); // 如果是元素，就递归生成
    } else {
      let text = el.text;
      if (!defaultTagRE.test(text)) return `_v('${text}')`; // 普通文本
      // 表达式，需要做一个表达式和普通值的拼接 ['aaa', _s(name), 'bbb'].join('+')

      let lastIndex = defaultTagRE.lastIndex = 0;
      let tokens = [];
      let match;

      while (match = defaultTagRE.exec(text)) {
        // 如果正则 + g 配合exec就会有一个问题 lastIndex问题
        let index = match.index;

        if (index > lastIndex) {
          tokens.push(JSON.stringify(text.slice(lastIndex, index)));
        }

        tokens.push(`_s(${match[1].trim()})`);
        lastIndex = index + match[0].length;
      }

      if (lastIndex < text.length) {
        tokens.push(JSON.stringify(text.slice(lastIndex)));
      }

      return `_v(${tokens.join("+")})`; // webpack 源码 css-loader 图片处理
    }
  }

  function genChildren(el) {
    let children = el.children;

    if (children) {
      return children.map(item => gen(item)).join(",");
    }

    return false;
  }

  function generate(ast) {
    let children = genChildren(ast);
    let code = `_c('${ast.tag}', ${ast.attrs.length ? genProps(ast.attrs) : "undefined"}${children ? `,${children}` : ""})`;
    return code;
  }

  const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z]*`; // 匹配标签名的  aa-xxx

  const qnameCapture = `((?:${ncname}\\:)?${ncname})`; //  aa:aa-xxx

  const startTagOpen = new RegExp(`^<${qnameCapture}`); //  此正则可以匹配到标签名 匹配到结果的第一个(索引第一个) [1]

  const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`); // 匹配标签结尾的 </div>  [1]

  const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/; // 匹配属性的
  // [1]属性的key   [3] || [4] ||[5] 属性的值  a=1  a='1'  a=""

  const startTagClose = /^\s*(\/?)>/; // 匹配标签结束的  />    >
  // vue3的编译原理比vue2里好很多，没有这么多正则了

  function parserHTML(html) {
    // 可以不停的截取模板，直到把模板全部解析完毕
    let stack = [];
    let root = null; // 我要构建父子关系

    function createASTElement(tag, attrs, parent = null) {
      return {
        tag,
        type: 1,
        // 元素
        children: [],
        parent,
        attrs
      };
    }

    function start(tag, attrs) {
      // [div,p]
      // 遇到开始标签 就取栈中的最后一个作为父节点
      let parent = stack[stack.length - 1];
      let element = createASTElement(tag, attrs, parent);

      if (root == null) {
        // 说明当前节点就是根节点
        root = element;
      }

      if (parent) {
        element.parent = parent; // 跟新p的parent属性 指向parent

        parent.children.push(element);
      }

      stack.push(element);
    }

    function end(tagName) {
      let endTag = stack.pop();

      if (endTag.tag != tagName) {
        console.log('标签出错');
      }
    }

    function text(chars) {
      let parent = stack[stack.length - 1];
      chars = chars.replace(/\s/g, "");

      if (chars) {
        parent.children.push({
          type: 2,
          text: chars
        });
      }
    }

    function advance(len) {
      html = html.substring(len);
    }

    function parseStartTag() {
      const start = html.match(startTagOpen); // 4.30 继续

      if (start) {
        const match = {
          tagName: start[1],
          attrs: []
        };
        advance(start[0].length);
        let end;
        let attr;

        while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
          // 1要有属性 2，不能为开始的结束标签 <div>
          match.attrs.push({
            name: attr[1],
            value: attr[3] || attr[4] || attr[5]
          });
          advance(attr[0].length);
        } // <div id="app" a=1 b=2 >


        if (end) {
          advance(end[0].length);
        }

        return match;
      }

      return false;
    }

    while (html) {
      // 解析标签和文本
      let index = html.indexOf('<');

      if (index == 0) {
        // 解析开始标签 并且把属性也解析出来  </div>
        const startTagMatch = parseStartTag();

        if (startTagMatch) {
          // 开始标签
          start(startTagMatch.tagName, startTagMatch.attrs);
          continue;
        }

        let endTagMatch;

        if (endTagMatch = html.match(endTag)) {
          // 结束标签
          end(endTagMatch[1]);
          advance(endTagMatch[0].length);
          continue;
        }
      } // 文本


      if (index > 0) {
        // 文本
        let chars = html.substring(0, index); //<div></div>

        text(chars);
        advance(chars.length);
      }
    }

    return root;
  } //  <div id="app">hello wolrd <span>hello</span></div> */}

  function compileToFunction(template) {
    // 1. 将模板变成ast语法树
    let ast = parserHTML(template); // 代码优化，标记静态节点(略过，不是重点)
    // 2. 代码生成

    let code = generate(ast); // 模板引擎的实现原理，都是new Function + with ejs jade handlerbar

    let render = new Function(`with(this){return ${code}}`);
    return render; //  1. 编译原理
    //  2. 响应式原理 依赖收集
    //  3. 组件化开发（贯穿了vue的流程）
    //  4. diff算法 
  }

  function isFunction(val) {
    return typeof val === "function";
  }
  function isObject(val) {
    return typeof val === "object" && val !== null;
  }
  let callbacks = [];
  let waiting = false;

  function flushCallbacks() {
    callbacks.forEach(fn => fn()); // 按照顺序清空nextTick

    callbacks = [];
    waiting = false;
  }

  function nextTick(fn) {
    // vue3里面的nextTick就是promise，vue2里面做了一些兼容性处理
    callbacks.push(fn);

    if (!waiting) {
      Promise.resolve().then(flushCallbacks);
      waiting = true;
    }
  }
  let strats = {}; // 存放所有策略

  let lifeCycle = ['beforeCreate', 'created', 'beforeMount', 'mounted'];
  lifeCycle.forEach(hook => {
    strats[hook] = function (parentVal, childVal) {
      if (childVal) {
        if (parentVal) {
          return parentVal.concat(childVal); // 父子都有值，用父和子拼接在一起，父有值就一定是数组
        } else {
          if (isArray(childVal)) {
            return childVal;
          }

          return [childVal]; // 如果没有值，就会变成数组
        }
      } else {
        return parentVal;
      }
    };
  });
  function mergeOptions(parentVal, childVal) {
    const options = {};

    for (let key in parentVal) {
      mergeField(key);
    }

    for (let key in childVal) {
      if (!parentVal.hasOwnProperty(key)) {
        mergeField(key);
      }
    }

    function mergeField(key) {
      // 设计模式：策略模式
      let strat = strats[key];

      if (strat) {
        options[key] = strat(parentVal[key], childVal[key]);
      } else {
        options[key] = childVal[key] || parentVal[key];
      }
    }

    return options;
  }
  let isArray = Array.isArray;

  let oldArrayPrototype = Array.prototype; // 获取数组老的原型方法

  let arrayMethods = Object.create(oldArrayPrototype); // 让arrayMethods通过__proto__能获取到数组的方法

  let methods = [// 只有这7个方法导致数组发生变化
  "push", "pop", "shift", "unshift", "reverse", "sort", "splice"];
  methods.forEach(method => {
    arrayMethods[method] = function (...args) {
      // 数组新增的属性，要看一下是不是对象，如果是对象，继续进行劫持
      // 需要调用数组原生逻辑
      oldArrayPrototype[method].call(this, ...args); // 可以添加自己的逻辑，函数劫持，切片

      let inserted = null;
      let ob = this.__ob__;

      switch (method) {
        case "splice":
          // 修改 删除 添加
          inserted = args.slice(2); // splice 方法从第三个参数起，是增添的新数据

          break;

        case "push":
        case "unshift":
          inserted = args; // 调用push和unshift传递的参数就是新增的逻辑

          break;
      } // 遍历数组inserted，看一下它是否需要进行二次劫持


      if (inserted) ob.observeArray(inserted);
      ob.dep.notify(); // 触发页面更新流程
    };
  }); // 属性的查找，是先找自己身上的，找不到去原型上查找

  let id$1 = 0; // dep.subs = [watcher];
  // watcher.deps = [dep];

  class Dep {
    constructor() {
      // 要把watcher放到dep中
      this.subs = [];
      this.id = id$1++;
    }

    depend() {
      // 给watcher也加一个标识 防止重复
      // this.subs.push(Dep.target); // 让dep记住这个watcher,watcher还要记住dep，相互关系
      Dep.target.addDep(this); // 在watcher中调用dep的addSub方法
    }

    addSub(watcher) {
      this.subs.push(watcher); // 让dep记住watcher
    }

    notify() {
      this.subs.forEach(watcher => {
        watcher.update();
      });
    }

  }

  Dep.target = null; // 这里用了一个全局的变量 window.target 静态属性

  // 2.每个原型上都有一个constructor属性，指向函数本身 Function.prototype.constructor = Function

  class Observer {
    constructor(value) {
      // 不让__ob__被遍历到
      // value.__ob__ = this; // 给对象和数组添加一个自定义属性
      // 如果给一个对象增添一个不存在的属性，我希望也能添加一个自定义属性 {}.dep => watcher
      this.dep = new Dep(); // 给对象和数组都增加dep属性 {} []

      Object.defineProperty(value, "__ob__", {
        value: this,
        enumerable: false // 不让__ob__被遍历到，不能被循环到

      });

      if (isArray(value)) {
        // 更改数组原型方法，如果是数组，我就改写数组的原型链
        value.__proto__ = arrayMethods;
        this.observeArray(value); // 数组 如何依赖收集，而且数组更新的时候，如何出发更新？
      } else {
        this.walk(value); // 核心就是循环对象
      }
    }

    observeArray(data) {
      // 递归遍历数组，对数组内部的对象再次重写 [{}] [[]]
      data.forEach(item => {
        // 数组里面如果是引用类型那么是响应式的
        // vm.arr[0].a = 100
        // vm.arr[0] = 100 可以改属性，不可以改索引
        observe(item);
      });
    }

    walk(data) {
      Object.keys(data).forEach(key => {
        // 要使用defineProperty重新定义
        defineReactive(data, key, data[key]);
      });
    }

  }

  function dependArray(value) {
    // 让数组里的引用类型都收集依赖
    for (let i = 0; i < value.length; i++) {
      let current = value[i];
      current.__ob__ && current.__ob__.dep.depend();

      if (Array.isArray(current)) {
        dependArray(current);
      }
    }
  } // vue2应用了defineProperty需要一加载的时候，就进行递归操作，所以耗性能，如果层次过深也会浪费性能
  // 1. 性能优化的原则
  //  1）不要把所有的数据都放在data中，因为所有的数据都会增加get和set
  //  2）不要写数据的时候，层次过深，尽量扁平化数据
  //  3）不要频繁获取数据
  //  4）如果数据不需要响应式，可以使用Object.freeze冻结属性


  function defineReactive(obj, key, value) {
    let childOb = observe(value); // 递归进行观测数据，不管有多少层，我都进行defineProperty，childOB有值，那么就是数组或者对象

    let dep = new Dep(); // 每个属性都增加了一个dep
    // vue2慢的原因 主要在这个方法中

    Object.defineProperty(obj, key, {
      get() {
        if (Dep.target) {
          dep.depend();

          if (childOb) {
            // 取属性的时候，会对对应的值（对象本身和数组）进行依赖收集
            childOb.dep.depend(); // 让数组和对象也记住当前的watcher

            if (Array.isArray(value)) {
              dependArray(value);
            }
          }
        }

        return value; // 闭包，此value会向上层的value进行查找
      },

      // 一个属性可能对应多个watcher，数组也有更新
      set(newValue) {
        // 如果设置的是一个对象，那么会再次进行劫持
        if (newValue === value) return;
        observe(newValue);
        value = newValue;
        dep.notify(); // 拿到当前的dep里面的watcher依次执行
      }

    });
  }

  function observe(value) {
    // 1. 如果value不是对象，那么就不用观测了，说明写的有问题
    if (!isObject(value)) {
      return;
    }

    if (value.__ob__) {
      return; // 一个对象不需要重复复观测
    } // 需要对对象进行观测（最外层必须是一个{} 不能是数组）
    // 如果一个数据已经被观测过了，就不要再进行观测了，用类来实现，我观测过就增加一个标识，说明观测过了，在观测的时候，可以先检测是否观测过，如果观测过了就跳过检测


    return new Observer(value);
  }

  function initState(vm) {
    const opts = vm.$options;

    if (opts.data) {
      initData(vm);
    }
  }

  function proxy(vm, key, source) {
    // 取值的时候做代理，不是暴力的把_data属性赋予给vm，而且直接复制会有命名冲突问题
    Object.defineProperty(vm, key, {
      get() {
        return vm[source][key];
      },

      set(newValue) {
        vm[source][key] = newValue;
      }

    });
  }

  function initData(vm) {
    let data = vm.$options.data; // 用户传入的数据
    // 如果用户传递的是一个函数，则取函数的返回值作为对象，如果就是对象那就直接使用这个对象
    // data和_data引用的是同一个人 => data被劫持了，vm._data也被劫持了

    data = vm._data = isFunction(data) ? data.call(vm) : data; // _data 已经是响应式了
    // 需要将data变成响应式的 Object.defineProperty，重写data中的所有属性

    observe(data); // 观测数据

    for (let key in data) {
      // vm.message => vm._data.message
      proxy(vm, key, "_data"); // 引用类型
    }
  }

  function createElement(vm, tag, data = {}, ...children) {
    // 返回虚拟节点
    return vnode(vm, tag, data, children, data.key, undefined);
  }
  function createText(vm, text) {
    // 返回虚拟节点
    return vnode(vm, undefined, undefined, undefined, undefined, text);
  } // 看两个节点是否相同节点，就看是不是tag和key都一样
  // vue2就有一个性能问题，递归比对

  function isSameVnode(newVnode, oldVnode) {
    return newVnode.tag === oldVnode.tag && newVnode.key === oldVnode.key;
  }

  function vnode(vm, tag, data, children, key, text) {
    return {
      vm,
      tag,
      data,
      children,
      key,
      text
    };
  } // vnode其实就是一个对象，用来描述节点的，这个和ast长得很像？
  // ast描述语法，并没有用户自己的逻辑，只有语法解析出来的内容
  // vnode是描述dom结构，可以自己去扩展属性

  function patch(oldVnode, vnode) {
    const isRealElement = oldVnode.nodeType;

    if (isRealElement) {
      // 删除老节点，根据vnode创建新节点，替换掉老节点
      const elm = createEle(vnode); // 根据虚拟节点创造了真实节点

      const parentNode = oldVnode.parentNode;
      parentNode.insertBefore(elm, oldVnode.nextSibling); // el.nextSibling 不存在就是null 如果为null insertBefore就是appendChild

      parentNode.removeChild(oldVnode);
      return elm; // 返回最新节点
    } else {
      // 不管怎么diff最终想更新渲染 -> dom操作里去
      // 只比较同级，如果不一样，儿子就不用比了，根据当前节点，创建儿子全部替换掉
      // diff算法如何实现
      if (!isSameVnode(oldVnode, vnode)) {
        // 如果新旧节点不是同一个，删除老的换成新的
        return oldVnode.el.parentNode.replaceChild(createEle(vnode), oldVnode.el);
      } // 文本直接更新即可，因为文本没有儿子


      let el = vnode.el = oldVnode.el; // 复用节点

      if (!oldVnode.tag) {
        // 没有tag，是文本了，一个是文本，另一个也一定是文本
        if (oldVnode.text !== vnode.text) {
          return el.textContent = vnode.text;
        }
      } // 元素


      updateProperties(vnode, oldVnode.data); // 是相同节点了，复用节点，再更新不一样的地方(属性)）
      // 比较儿子节点

      let oldChildren = oldVnode.children || [];
      let newChildren = vnode.children || []; // 情况1：老的有儿子，新的没儿子

      if (oldChildren.length > 0 && newChildren.length === 0) {
        el.innerHTML = '';
      } else if (newChildren.length > 0 && oldChildren.length === 0) {
        // 新的有儿子，老的没儿子，直接插入即可
        newChildren.forEach(child => el.appendChild(createEle(child)));
      } else {
        // 新老都有儿子
        updateChildren(el, oldChildren, newChildren);
      }
    }
  }
  function createEle(vnode) {
    let {
      tag,
      data,
      children,
      text,
      vm
    } = vnode; // 我们让虚拟节点和真实节点做一个映射关系，后续某个虚拟节点更新，我可以跟踪到真实节点，并且更新真实节点

    if (typeof tag === "string") {
      vnode.el = document.createElement(tag); // 如果有data属性，需要把data设置到元素上

      updateProperties(vnode, data);
      children.forEach(child => {
        vnode.el.appendChild(createEle(child));
      });
    } else {
      vnode.el = document.createTextNode(text);
    }

    return vnode.el;
  }

  function updateProperties(vnode, oldProps = {}) {
    // 这里的逻辑，可能是初次渲染，初次渲染直接用oldProps给vnode的el赋值即可
    // 更新逻辑，拿到老的props和vnode里面的data进行比对
    let el = vnode.el; // dom真实的节点

    let newProps = vnode.data || {}; // 新旧比对，两个对象如何比对差异？

    let newStyle = newProps.style || {};
    let oldStyle = oldProps.style || {};

    for (let key in oldStyle) {
      if (!newStyle[key]) {
        // 老的样式有，新的没有，就把页面上的样式删除
        el.style[key] = '';
      }
    }

    for (let key in newProps) {
      // 直接用新的盖掉老的就可以了
      if (key === 'style') {
        for (let key in newStyle) {
          el.style[key] = newStyle[key];
        }
      } else {
        el.setAttribute(key, newProps[key]);
      }
    }

    for (let key in oldProps) {
      if (!newProps[key]) {
        el.removeAttribute(key);
      }
    }
  }

  function updateChildren(el, oldChildren, newChildren) {
    // vue中，如何做的diff算法
    console.log(el, oldChildren, newChildren); // vue内部做了优化(尽量提升性能，如果实在不行，再暴力比对)
    // 1. 在列表中新增和删除的情况

    let oldStartIndex = 0;
    let oldStartVnode = oldChildren[0];
    let oldEndIndex = oldChildren.length - 1;
    let oldEndVnode = oldChildren[oldEndIndex];
    let newStartIndex = 0;
    let newStartVnode = newChildren[0];
    let newEndIndex = newChildren.length - 1;
    let newEndVnode = newChildren[newEndIndex];

    function makeKeyByIndex(children) {
      let map = {};
      children.forEach((item, index) => {
        map[item.key] = index;
      });
      return map;
    }

    let mapping = makeKeyByIndex(oldChildren); // diff算法的复杂度，是O(n)。比对的时候，指针交叉的时候，就是比对完成了

    while (oldStartIndex <= oldEndIndex && newStartIndex <= newEndIndex) {
      if (!oldStartVnode) {
        // 在指针移动的时候 可能元素已经被移动走了，那就跳过这一项
        oldStartVnode = oldChildren[++oldStartIndex];
      } else if (!oldEndVnode) {
        oldEndVnode = oldChildren[--oldEndIndex];
      } else if (isSameVnode(oldStartVnode, newStartVnode)) {
        // 头头比较
        patch(oldStartVnode, newStartVnode); // 递归比较子节点，同时比对这两个人的差异

        oldStartVnode = oldChildren[++oldStartIndex];
        newStartVnode = newChildren[++newStartIndex];
      } else if (isSameVnode(oldEndVnode, newEndVnode)) {
        // 尾尾比较
        patch(oldEndVnode, newEndVnode); // 递归比较子节点，同时比对这两个人的差异

        oldEndVnode = oldChildren[--oldEndIndex];
        newEndVnode = newChildren[--newEndIndex];
      } else if (isSameVnode(oldStartVnode, newEndVnode)) {
        // 头尾比较
        patch(oldStartVnode, newEndVnode);
        el.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling);
        oldStartVnode = oldChildren[++oldStartIndex];
        newEndVnode = newChildren[--newEndIndex];
      } else if (isSameVnode(oldEndVnode, newStartVnode)) {
        // 尾头比较
        patch(oldEndVnode, newStartVnode);
        el.insertBefore(oldEndVnode.el, oldStartVnode.el);
        oldEndVnode = oldChildren[--oldEndIndex];
        newStartVnode = newChildren[++newStartIndex];
      } else {
        // 之前的逻辑都是考虑用户一些特殊情况，但是有非特殊的，乱序排
        let moveIndex = mapping[newStartVnode.key];

        if (moveIndex == undefined) {
          // 没有直接将节点插入到开头的前面
          el.insertBefore(createEle(newStartVnode), oldStartVnode.el);
        } else {
          // 有的话需要复用
          let moveVnode = oldChildren[moveIndex]; // 找到复用的那个，将它移动到前面去

          el.insertBefore(moveVnode.el, oldStartVnode.el);
          patch(moveVnode, newStartVnode);
          oldChildren[moveIndex] = undefined; // 将移动的节点标记为空
        }

        newStartVnode = newChildren[++newStartIndex];
      }
    }

    if (newStartIndex <= newEndIndex) {
      // 新的多，那么就将多的插入进去即可
      // 如果下一个是null就是appendChild
      let anchor = newChildren[newEndIndex + 1] == null ? null : newChildren[newEndIndex + 1].el; // 参照物是固定的

      for (let i = newStartIndex; i <= newEndIndex; i++) {
        // 看一下，当前尾结点的下一个元素是否存在，如果存在则是插入到下一个元素的前面
        // 这里可能是向前追加，可能是向后追加
        el.insertBefore(createEle(newChildren[i]), anchor);
      }
    }

    if (oldStartIndex <= oldEndIndex) {
      // 老的多 需要清理掉，直接删除即可
      for (let i = oldStartIndex; i <= oldEndIndex; i++) {
        let child = oldChildren[i]; // child可能是undefined，所以要跳过空节点

        child && el.removeChild(child.el);
      }
    }
  }

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

  function queueWatcher(watcher) {
    // 一般情况下，写去重，可以采用这种方式，如果你不使用set的时候
    let id = watcher.id;

    if (has[id] == null) {
      has[id] = true;
      queue.push(watcher);

      if (!pending) {
        // 防抖：多次执行，只走一次
        nextTick(flushSchedulerQueue);
        pending = true;
      }
    }
  }

  let id = 0;

  class Watcher {
    // 要把dep放到watcher中
    constructor(vm, fn, cb, options) {
      // $watch()
      this.vm = vm;
      this.fn = fn;
      this.cb = cb;
      this.options = options;
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
      Dep.target = this; // Dep.target = watcher 利用js单线程，先赋值

      this.getter(); // 页面渲染的逻辑 _update(_render()) vm.name / vm.age 再取值

      Dep.target = null; // 渲染完毕后就将标识清空，只有在渲染的时候才会进行依赖收集
    }

    update() {
      // 每次更新都会同步调用update方法，我可以将更新的逻辑缓存起来，等会同步更新数据的逻辑执行完毕后依次调用(去重的逻辑)
      queueWatcher(this); // 可以做异步更新处理
      // this.get(); // vue.nextTick [fn1 fn2 fn3]
    }

    run() {
      this.get();
    }

  }

  function mountComponent(vm) {
    // 初始化流程
    let updateComponent = () => {
      vm._update(vm._render()); // render() _c _v _s

    }; // 每个组件都有一个watcher，我们把这个watcher称之为渲染watcher


    callHook(vm, 'beforeCreate');
    new Watcher(vm, updateComponent, () => {
      console.log('后续增添狗仔函数 update');
      callHook(vm, 'created');
    }, true);
    callHook(vm, 'mounted'); // updateComponent();
  }
  function lifeCycleMixin(Vue) {
    Vue.prototype._update = function (vnode) {
      // 采用的是 先序深度遍历 创建节点(遇到节点就创造节点，递归创建)
      const vm = this; // 第一次渲染，是根据虚拟节点，生成真实节点，替换掉原来的节点
      // 如果是第二次，生成一个新的虚拟节点，和老的虚拟节点进行对比

      vm.$el = patch(vm.$el, vnode);
    };
  }
  function callHook(vm, hook) {
    let handlers = vm.$options[hook];
    handlers && handlers.forEach(item => {
      item.call(vm); // 生命周期的this永远指向实例
    });
  }

  function initMixin(Vue) {
    // 后续组件化开发的时候，Vue.extend可以创造一个子组件，子组件可以继承Vue，子组件也可以调用_init方法
    Vue.prototype._init = function (options) {
      const vm = this; // 把用户的选项放到vm上，这样在其他方法中都可以获取到options了

      vm.$options = mergeOptions(vm.constructor.options, options); // 为了后续扩展的方法， 都可以获取$options

      initState(vm); // options中是用户传入的数据 el, data

      if (vm.$options.el) {
        // 要将数据挂载到页面上
        // 现在数据已经被劫持了，数据变化需要更新视图 diff算法更新需要更新的部分
        // vue -> template(写起来更符合直觉) -> jsx(灵活)
        // vue3 template 写起来性能会更高一些 内部做了很多优化
        // template -> ast语法树(用来描述语法的，描述语法本身) -> 描述成一个树结构 -> 将代码重组成js语法
        // 模板编译原理(把template模板编译成render函数 -> 虚拟DOM -> diff 算法比对虚拟DOM)
        // ast -> render返回 -> vnode -> 生成真实DOM
        // 更新的时候再次调用render -> 新的vnode -> 新旧比对 -> 更新真实DOM
        vm.$mount(vm.$options.el);
      }
    };

    Vue.prototype.$mount = function (el) {
      const vm = this;
      const opts = vm.$options;
      el = document.querySelector(el); // 获取真实的元素

      vm.$el = el; // 页面真实元素

      if (!opts.render) {
        // 模板编译
        opts.template;

        let render = compileToFunction(el.outerHTML);
        opts.render = render;
      } // 这里已经获取到了 一个render函数，这个函数他的返回值 _c('div', {id: 'app'}, _c('span', undefined, 'hello'))


      mountComponent(vm); // console.log(opts.render);
    };

    Vue.prototype.$nextTick = nextTick;
  }

  function renderMixin(Vue) {
    Vue.prototype._c = function () {
      // createElement 创建元素型的节点
      const vm = this;
      return createElement(vm, ...arguments); // 描述虚拟节点是属于那个实例的
    };

    Vue.prototype._v = function (text) {
      // 创建文本的虚拟的节点
      const vm = this;
      return createText(vm, text); // 描述虚拟节点是属于那个实例的
    };

    Vue.prototype._s = function (val) {
      // JSON.stringify()
      if (isObject(val)) {
        return JSON.stringify(val);
      } else {
        return val;
      }
    };

    Vue.prototype._render = function () {
      const vm = this; // vm中所所有数据 vm.xxx -> vm._data.xxx

      let {
        render
      } = vm.$options;
      let vnode = render.call(vm);
      return vnode;
    };
  }

  function initGlobalAPI(Vue) {
    Vue.options = {}; // 全局属性，在每个组件初始化的时候，将这些属性放到每个组件上

    Vue.mixin = function (options) {
      this.options = mergeOptions(this.options, options);
      return this;
    };

    Vue.conponent = function name(params) {};

    Vue.filter = function name(params) {};

    Vue.directive = function name(params) {};
  }

  function Vue(options) {
    this._init(options); // 实现vue的初始化功能

  }

  initMixin(Vue);
  renderMixin(Vue);
  lifeCycleMixin(Vue);
  initGlobalAPI(Vue); // 先生成一个虚拟节点

  let vm1 = new Vue({
    data() {
      return {
        name: 'pangfeng'
      };
    }

  });
  let render1 = compileToFunction(`<div>
  <li key="A">A</li>
  <li key="B">B</li>
  <li key="C">C</li>
  <li key="D">D</li>
</div>`);
  let oldVnode = render1.call(vm1); // 第一次的虚拟节点

  let el1 = createEle(oldVnode);
  document.body.appendChild(el1); // 再生成一个新的虚拟节点 patch

  let vm2 = new Vue({
    data() {
      return {
        name: '黑白灰'
      };
    }

  });
  let render2 = compileToFunction(`<div>
  <li key="F">F</li>
  <li key="B">B</li>
  <li key="A">A</li>
  <li key="E">E</li>
  <li key="P">P</li>
</div>`);
  let newVnode = render2.call(vm2);
  setTimeout(() => {
    patch(oldVnode, newVnode); // 比对两个虚拟节点的差异，更新需要更新的地方
  }, 2000); //  导出Vue给别人使用
  // 1. vue里面用到了观察者模式，默认组件渲染的时候，会创建一个watcher(并且会渲染视图)
  // 2. 当渲染视图的时候，会取data中的数据，会走每个属性的get方法，就让这个属性的dep记录watcher
  // 3. 同时让watcher也记住dep(这个逻辑目前没有用到)，dep和watcher是多对多的关系，因为一个属性可能对应多个视图，一个视图赌赢多个数据
  // 4. 如果数据发生变化，会通知对应属性的dep，依次通知存放的watcher去更新

  return Vue;

}));
//# sourceMappingURL=vue.js.map
