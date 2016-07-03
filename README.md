# san-validation

`san-validation`提供了一系列简单的函数，基于[jsen](https://github.com/bugventure/jsen)实现对象的验证，验证使用JSON Schema作为对象描述，返回错误信息与jsen一致。

本类库的`validation`模块（也即主模块）为一个函数，称之为`validation`函数，其签名如下：

```
{Function} validation({Object} schema, {Object | null} messages, {Object} [options])
```

该函数返回一个函数，用于对输入进行校验，校验返回一个对象，结构如下：

```
{
    {boolean} isValid,
    [Object[]] errors
}
```

其中`errors`对象为jsen返回的结果，具体请查看jsen的相关API。

普通的使用方法：

```js
import validation from 'san-validation';

let validate = validation(mySchema);

let {isValid, errors} = validate(inputForm);
if (!isValid) {
    reportErrors(errors);
}
```

## 消息分离

在一些业务中，同样的JSON Schema会用于不同的视图界面，在不同的界面则要应用不同的错误信息。本类库支持将JSON Schema中的结构描述与错误信息进行分离，这么做也可以让schema更纯粹地描述一个对象的结构，而与校验有关的信息则在实际进行校验时再提供。

使用`validation`函数的第二个参数可以对原有的schema添加错误信息，假设我们的原schema如下：

```javascript
let schema = {
   type: 'object',
   description: 'product',
   properties: {
       categoryId: {
           type: 'number',
           description: 'category'
       },
       tags: {
           type: 'array',
           description: 'tags',
           minItems: 1,
           uniqueItems: true,
           items: {
               type: 'string',
               description: 'tag of product',
               maxLength: 30
           }
       },
       sales: {
           type: 'array',
           items: {
               type: 'object',
               properties: {
                   year: {
                       type: 'number',
                       description: 'sales year',
                       minimum: 1900
                   },
                   month: {
                       type: 'number',
                       description: 'sales month',
                       minimum: 1,
                       maximum: 12
                   },
                   quantity: {
                       type: 'number',
                       description: 'sales quantity',
                       minimum: 0
                   }
               }
           }
       }
   },
   required: ['categoryId', 'sales']
}
```

对应的`message`对象如下：

```javascript
let message = {
    type: 'Invalid ${description} type',

    categoryId: {
        type: 'Invalid ${description} type'
    },

    tags: {
        minItems: 'There should be no less than ${minItems} ${description}',
        uniqueItems: 'Duplicate ${description}',

        items: {
            type: '${description} should be ${type}s',
            maxLength: 'Each ${description} should have no more than ${maxLength} characters'
        }
    },

    sales: {
        items: {
            year: {
                minimum: '${description} is too early'
            },

            month: {
                minimum: '${description} should fall within 1 - 12',
                maximum: '${description} should fall within 1 - 12'
            },

            quantity: {
                minimum: 'Need a positive ${description}'
            }
        }
    }
}
```

在`message`对象中，可以使用`${xxx}`占位符输出，占位符可用的内容与这个字段的schema中的属性对应，但**并不会向上或向下找父字段/子字段的相关属性**。

`validation`函数会将`message`中的各个错误消息合并到schema中，大致的合并算法如下：

1. 找到`invalidMessage`和`requiredMessage`直接与原schema合并，从`message`中移除这2个属性
2. `message`的每个属性，如果值为字符串则是一个错误消息模板，如果是对象则为更进一步的属性-错误信息配置。
3. 将同级别的`message`中错误信息提取出来，作为`messages`属性与原schema合并
4. 将其它属性提取出来，如果原schema的`type`为`object`，则作为`properties`与原schema合并
5. 如果原schema的`type`为`array`，则提取`items`属性与原schema合并

因此基于上面的结构，我们可以进行校验：

```javascript
let product = {
    categoryId: 'invalid',

    tags: [
        'x'.repeat(50),
        'x'.repeat(50),
        123
    ],

    sales: [
        {year: 1800, month: 14, quantity: -23}
    ]
};

let {isValid, errors} = validation(schema, message, {greedy: true})(product);
```

这样我们可以得到以下的错误`errors`对象：

```javascript
[
    {path: 'categoryId', keyword: 'type', message: 'Invalid category type'},
    {path: 'tags', keyword: 'uniqueItems', message: 'Duplicate tags'},
    {path: 'tags.0', keyword: 'maxLength', message: 'Each tag of product should have no more than 30 characters'},
    {path: 'tags.1', keyword: 'maxLength', message: 'Each tag of product should have no more than 30 characters'},
    {path: 'tags.2', keyword: 'type', message: 'tag of product should be strings'},
    {path: 'sales.0.year', keyword: 'minimum', message: 'sales year is too early'},
    {path: 'sales.0.month', keyword: 'maximum', message: 'sales month should fall within 1 - 12'},
    {path: 'sales.0.quantity', keyword: 'minimum', message: 'Need a positive sales quantity'},
]
```

可以看到每一个错误对象都使用了`message`配置中对应的消息，对于数组则使用的`items`中配置的消息。

## 默认错误信息

大部分业务项目有一套默认的错误信息规则，如所有“必填”字段的提示均为“XXX字段为必填项”，我们不希望每次编写schema时都对这些字段一一指明错误信息，因此`san-validation`提供了支持默认错误信息的功能。

`validation`模块的`withDefaultMessages`函数接收一个默认消息配置对象，返回一个新的`validation`函数。

默认消息配置对象的每个键对应一个错误类型（如`type`、`minLength`、`maximum`等），值为一个函数，该函数接收当前字段的schema，需要返回错误信息字符串。

我们通常推荐一个项目独立一个模块提供自己的`validation`函数，可在这个模块内配置默认错误信息，如编写一个`common/validation.js`文件，可以使用以下代码提供默认的错误信息：

```javascript
/**
 * @file common.validation.js
 */

import {withDefaultMessages} from 'san-validation';

let messages = {
    type: ({description}) => `${description}的类型不符`,
    minLength: ({description, minLength}) => {
        if (minLength === 1) {
            return `必须输入${description}`;
        }

        return `${description}不得小于${minLength}个字符`;
    },
    ...
};

export default withDefaultMessages(messages);
```

其它模块则直接使用项目中的`validation`模块：

```javascript
import validation from 'common/validation';
import schema from './schema';

// 额外的错误信息
let errorMessages = {
    roles: {
        items: {
            oneOf: '用户角色必须为“正常用户”、“VIP”、“管理员”之一'
        }
    }
};
let validateUser = validation(schema, errorMessages, {greedy: true});

export default class Form {
    validate(input) {
        return validateUser(input);
    }
}
```
