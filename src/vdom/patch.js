import {isSameVnode} from "./index";

export function patch(oldVnode, vnode) {
  const isRealElement = oldVnode.nodeType;

  if (isRealElement) {
    // 删除老节点，根据vnode创建新节点，替换掉老节点
    const elm = createEle(vnode); // 根据虚拟节点创造了真实节点
    const parentNode = oldVnode.parentNode;
    parentNode.insertBefore(elm, oldVnode.nextSibling); // el.nextSibling 不存在就是null 如果为null insertBefore就是appendChild
    parentNode.removeChild(oldVnode);
    return elm; // 返回最新节点
  } else { // 不管怎么diff最终想更新渲染 -> dom操作里去
    // 只比较同级，如果不一样，儿子就不用比了，根据当前节点，创建儿子全部替换掉
    // diff算法如何实现
    if (!isSameVnode(oldVnode, vnode)) { // 如果新旧节点不是同一个，删除老的换成新的
      return oldVnode.el.parentNode.replaceChild(createEle(vnode), oldVnode.el);
    }

    // 文本直接更新即可，因为文本没有儿子
    let el = vnode.el = oldVnode.el; // 复用节点
    if (!oldVnode.tag) { // 没有tag，是文本了，一个是文本，另一个也一定是文本
      if (oldVnode.text !== vnode.text) {
        return el.textContent = vnode.text
      }
    }

    // 元素
    updateProperties(vnode, oldVnode.data);

    // 是相同节点了，复用节点，再更新不一样的地方(属性)）

    // 比较儿子节点
    let oldChildren = oldVnode.children || [];
    let newChildren = vnode.children || [];
    // 情况1：老的有儿子，新的没儿子
    if (oldChildren.length > 0 && newChildren.length === 0) {
      el.innerHTML = '';
    } else if (newChildren.length > 0 && oldChildren.length === 0) { // 新的有儿子，老的没儿子，直接插入即可
      newChildren.forEach(child => el.appendChild(createEle(child)));
    } else { // 新老都有儿子
      updateChildren(el, oldChildren, newChildren);
    }
  }
}

export function createEle(vnode) {
  let {tag, data, children, text, vm} = vnode;

  // 我们让虚拟节点和真实节点做一个映射关系，后续某个虚拟节点更新，我可以跟踪到真实节点，并且更新真实节点
  if (typeof tag === "string") {
    vnode.el = document.createElement(tag);
    // 如果有data属性，需要把data设置到元素上
    updateProperties(vnode, data);
    children.forEach(child => {
      vnode.el.appendChild(createEle(child))
    })
  } else {
    vnode.el = document.createTextNode(text);
  }
  return vnode.el;
}

function updateProperties(vnode, oldProps = {}) {
  // 这里的逻辑，可能是初次渲染，初次渲染直接用oldProps给vnode的el赋值即可
  // 更新逻辑，拿到老的props和vnode里面的data进行比对
  let el = vnode.el; // dom真实的节点
  let newProps = vnode.data || {};
  // 新旧比对，两个对象如何比对差异？
  let newStyle = newProps.style || {};
  let oldStyle = oldProps.style || {};
  for (let key in oldStyle) {
    if (!newStyle[key]) { // 老的样式有，新的没有，就把页面上的样式删除
      el.style[key] = '';
    }
  }
  for (let key in newProps) { // 直接用新的盖掉老的就可以了
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
  console.log(el, oldChildren, newChildren);
  // vue内部做了优化(尽量提升性能，如果实在不行，再暴力比对)
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
    })
    return map;
  }

  let mapping = makeKeyByIndex(oldChildren)

  // diff算法的复杂度，是O(n)。比对的时候，指针交叉的时候，就是比对完成了
  while (oldStartIndex <= oldEndIndex && newStartIndex <= newEndIndex) {
    if (!oldStartVnode) { // 在指针移动的时候 可能元素已经被移动走了，那就跳过这一项
      oldStartVnode = oldChildren[++oldStartIndex];
    } else if (!oldEndVnode) {
      oldEndVnode = oldChildren[--oldEndIndex];
    } else if (isSameVnode(oldStartVnode, newStartVnode)) { // 头头比较
      patch(oldStartVnode, newStartVnode); // 递归比较子节点，同时比对这两个人的差异
      oldStartVnode = oldChildren[++oldStartIndex];
      newStartVnode = newChildren[++newStartIndex];
    } else if (isSameVnode(oldEndVnode, newEndVnode)) { // 尾尾比较
      patch(oldEndVnode, newEndVnode); // 递归比较子节点，同时比对这两个人的差异
      oldEndVnode = oldChildren[--oldEndIndex];
      newEndVnode = newChildren[--newEndIndex];
    } else if (isSameVnode(oldStartVnode, newEndVnode)) { // 头尾比较
      patch(oldStartVnode, newEndVnode);
      el.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling);
      oldStartVnode = oldChildren[++oldStartIndex];
      newEndVnode = newChildren[--newEndIndex];
    } else if (isSameVnode(oldEndVnode, newStartVnode)) { // 尾头比较
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
  if (newStartIndex <= newEndIndex) { // 新的多，那么就将多的插入进去即可
    // 如果下一个是null就是appendChild
    let anchor = newChildren[newEndIndex + 1] == null ? null : newChildren[newEndIndex + 1].el; // 参照物是固定的
    for (let i = newStartIndex; i <= newEndIndex; i++) {
      // 看一下，当前尾结点的下一个元素是否存在，如果存在则是插入到下一个元素的前面
      // 这里可能是向前追加，可能是向后追加
      el.insertBefore(createEle(newChildren[i]), anchor)
    }
  }
  if (oldStartIndex <= oldEndIndex) { // 老的多 需要清理掉，直接删除即可
    for (let i = oldStartIndex; i <= oldEndIndex; i++) {
      let child = oldChildren[i]; // child可能是undefined，所以要跳过空节点
      child && el.removeChild(child.el);
    }
  }
}
