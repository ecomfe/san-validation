/**
 * san-validation
 *
 * @file main module
 * @author otakustay
 * @module validation
 */

import update from 'diffy-update';
import jsen from 'jsen';

let format = (str, context) => str.replace(/\$\{(\w+)\}/g, (match, key) => context[key]);

let mapObject = (object, map) => Object.entries(object).reduce(
    (reuslt, [key, value]) => {
        reuslt[key] = map(value, key);
        return reuslt;
    },
    {}
);

let isEmpty = target => {
    /* eslint-disable fecs-use-for-of */
    for (let key in target) {
        if (target.hasOwnProperty(key)) {
            return false;
        }
    }
    /* eslint-enable fecs-use-for-of */

    return true;
};

let pick = (object, ...keys) => {
    if (!object) {
        return {};
    }

    return keys.reduce(
        (result, key) => {
            if (object.hasOwnProperty(key)) {
                result[key] = object[key];
            }

            return result;
        },
        {}
    );
};

let visitSchema = (source, path) => path.split('.').reduce(
    (result, property) => {
        if (!result) {
            return result;
        }

        if (result.type === 'object') {
            return result.properties[property];
        }
        else if (result.type === 'array' && !Number.isNaN(property)) {
            return result.items;
        }

        return undefined;
    },
    source
);

let buildCommands = (schemaNode, messageNode) => {
    let commands = mapObject(
        pick(messageNode, 'invalidMessage', 'requiredMessage'),
        value => {
            return {$set: format(value, schemaNode)};
        }
    );

    let [messageProperties, otherProperties] = Object.entries(messageNode).reduce(
        ([messageProperties, otherProperties], [key, value]) => {
            if (key === 'invalidMessage' || key === 'requiredMessage') {
                return [messageProperties, otherProperties];
            }

            if (typeof value === 'string') {
                messageProperties[key] = value;
            }
            else {
                otherProperties[key] = value;
            }

            return [messageProperties, otherProperties];
        },
        [{}, {}]
    );

    if (!isEmpty(messageProperties)) {
        commands.messages = {$merge: mapObject(messageProperties, value => format(value, schemaNode))};
    }

    if (isEmpty(otherProperties)) {
        return commands;
    }

    if (schemaNode.type === 'object') {
        commands.properties = mapObject(
            otherProperties,
            (value, key) => buildCommands(schemaNode.properties[key], value)
        );
    }
    else if (schemaNode.type === 'array' && otherProperties.items) {
        commands.items = buildCommands(schemaNode.items, otherProperties.items);
    }

    return commands;
};

let mergeSchema = (schema, message) => update(schema, buildCommands(schema, message));

/**
 * 返回带有默认消息生成逻辑的验证函数生成器
 *
 * @param {Object<string, Function>} messages 默认消息生成对象，其键为错误类型，值为生成消息的函数，函数接收当前字段schema
 * @return {Function} 一个验证函数生成器，参考`validation`函数说明
 */
export let withDefaultMessages = messages => {
    let fillMessage = (error, schema) => {
        if (error.message) {
            return error;
        }

        let schemaNode = visitSchema(schema, error.path);
        let generateMessage = messages[error.keyword];
        if (schemaNode && generateMessage) {
            return update(error, {message: {$set: generateMessage(schemaNode)}});
        }

        return error;
    };

    return (schema, message, options) => {
        let validationSchema = message ? mergeSchema(schema, message) : schema;
        let validate = jsen(validationSchema, options);

        return input => {
            let isValid = validate(input);
            let errors = validate.errors.map(error => fillMessage(error, schema));

            return {isValid, errors};
        };
    };
};

/**
 * 验证函数生成器，接收对应的schema及配置返回验证函数
 *
 * 该函数支持描述结构的JSON Schema对象与验证错误消息的对象分离，提供第二个参数`message`可支持对应字段的验证消息的配置，
 * 具体的`message`对象支持的结构和格式请参考`README`对应说明
 *
 * @function default
 * @param {Object} schema 用于验证的JSON Schema对象
 * @param {Object | null} message 提示消息的schema对象
 * @param {Object} [options] 用于jsen的配置项
 */
export default withDefaultMessages({});
