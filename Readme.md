### 项目启动
1. 拉取代码 
  ```bash
  git clone https://github.com/TheKillerInside/vue-stage.git
  ```
2. 进入项目目录，执行
  ```bash
  npm install
  ```
3. 启动项目
  ```bash
  npm run dev
  ```


### vue2源码解析
1. new Vue会调用_init方法进行初始化操作
2. 会将用户的选项放到vm.$options上
3. 会对当前属性上搜索有没有data数据 initState
4. 有data判断data是不是一个函数，如果是函数取返回值 initData
5. observe去观测data中的数据和vm没关系，说明data已经变成了响应式
6. vue上取值也能取到data中的数据 vm._data = data 这样用户能取到data了 vm._data
7. 用户觉得有点麻烦 vm.xxx => vm._data
8. 如果更新对象不存在的属性，会导致视图不更新，如果是数组，更新索引和长度不会出发更新
9. 如果是替换成一个新对象，新对象会被劫持，如果是数组存放新内容 push unshift 新增的内容也会被劫持，通过__ob__ 进行标识这个对象被监控过（在vue中被监控的对象身上都有一个__ob__这个属性）
10. 如果你就想改索引，可以使用$set方法，内部使用splice

如果有el需要挂载到页面上

### 初渲染
1. 默认会调用vue_init方法将用户的参数挂载到$options选项中 vm.$options
2. vue会根据用户参数进行数据的初始化 props computed watch，会获取到对象作为数据，可以通过vm._data访问到用户的数据
3. 对数据进行观测 对象(递归使用defineProperty)、数组(方法的重写)，劫持到用户的操作，比如用户修改了数据 -> 更新视图 性能问题
4. 将数据代理到vm对象上 vm.xx -> vm._data.xx
5. 判断用户是否传入了el属性，内部会调用$mount方法，此方法也可以用户自己调用
6. 对模板的优先级处理 render -> template -> outerHTML
7. 将模板编译成函数 parserHTML解析模板 -> ast语法树 解析语法树生成code(codegen) -> render函数
8. 通过render方法 生成虚拟dom + 真实的数据 -> 真实dom
9. 根据虚拟节点渲染成真实节点

### 更新流程
- 只有根组件的情况：每个属性都有一个dep
1. vue里面用到了观察者模式，默认组件渲染的时候，会创建一个watcher(并且会渲染视图)
2. 当渲染视图的时候，会取data中的数据，会走每个属性的get方法，就让这个属性的dep记录watcher
3. 同时让watcher也记住dep(这个逻辑目前没有用到)，dep和watcher是多对多的关系，因为一个属性可能对应多个视图，一个视图赌赢多个数据
4. 如果数据发生变化，会通知对应属性的dep，依次通知存放的watcher去更新

### vue数组依赖收集
1. 默认vue在初始化的时候，会对对象每一个属性都进行劫持，增加dep属性，当取值的时候会做依赖收集
2. 默认还会对属性值是(对象和数组的本身进行增加dep属性)进行依赖收集
3. 如果是属性变化，触发属性对应的dep去更新
4. 如果是数组更新，触发数组的本身的dep进行更新
5. 如果取值的时候数组还要让数组中的对象类型也进行依赖收集(递归依赖收集)
6. 如果是数组里面放对象，默认对象里的属性是会进行依赖收集的，因为在取值时会进行JSON.stringify操作
