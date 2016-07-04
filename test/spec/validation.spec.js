import validation, {withDefaultMessages} from 'validation';

describe('validation', () => {
    it('should be a function', () => {
        expect(typeof validation).toBe('function');
    });

    it('should pass validation for simple schema', () => {
        let schema = {
            type: 'object',
            properties: {
                id: {
                    type: 'number'
                },
                name: {
                    type: 'string'
                }
            }
        };
        let {isValid, errors} = validation(schema)({id: 123, name: 'foo'});
        expect(isValid).toBe(true);
        expect(errors).toEqual([]);
    });

    it('should report validation errors', () => {
        let schema = {
            type: 'object',
            properties: {
                id: {
                    type: 'number'
                }
            }
        };
        let {isValid, errors} = validation(schema)({id: 'foo'});
        expect(isValid).toBe(false);
        expect(errors).toEqual([{path: 'id', keyword: 'type'}]);
    });

    it('should accept message schema', () => {
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
        };

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
        };

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
        expect(isValid).toBe(false);
        expect(errors).toEqual([
            {path: 'categoryId', keyword: 'type', message: 'Invalid category type'},
            {path: 'tags', keyword: 'uniqueItems', message: 'Duplicate tags'},
            {path: 'tags.0', keyword: 'maxLength', message: 'Each tag of product should have no more than 30 characters'},
            {path: 'tags.1', keyword: 'maxLength', message: 'Each tag of product should have no more than 30 characters'},
            {path: 'tags.2', keyword: 'type', message: 'tag of product should be strings'},
            {path: 'sales.0.year', keyword: 'minimum', message: 'sales year is too early'},
            {path: 'sales.0.month', keyword: 'maximum', message: 'sales month should fall within 1 - 12'},
            {path: 'sales.0.quantity', keyword: 'minimum', message: 'Need a positive sales quantity'},
        ]);
    })
});

describe('withDefaultMessages', () => {
    it('should be a function', () => {
        expect(typeof withDefaultMessages).toBe('function');
    });

    it('should fill default message on errors', () => {
        let schema = {
            type: 'object',
            properties: {
                id: {
                    description: 'id',
                    type: 'number'
                },
                firstName: {
                    type: 'string',
                    minLength: 10,
                    messages: {
                        minLength: 'first name should be no less than 10 characters'
                    }
                },
                lastName: {
                    type: 'string',
                    minLength: 10
                },
                roles: {
                    type: 'array',
                    items: {
                        description: 'user role',
                        maxLength: 4
                    }
                }
            }
        };
        let defaultMessages = {
            type: ({description, type}) => `${description} should be of type ${type}`,
            maxLength: ({description, maxLength}) => `${description} should be no longer than ${maxLength} characters`
        };
        let validate = withDefaultMessages(defaultMessages)(schema, null, {greedy: true});
        let {isValid, errors} = validate({id: 'invalid', firstName: 'foo', lastName: 'bar', roles: ['abcdefg']});
        expect(isValid).toBe(false);
        expect(errors).toEqual([
            {path: 'id', keyword: 'type', message: 'id should be of type number'},
            {path: 'firstName', keyword: 'minLength', message: 'first name should be no less than 10 characters'},
            {path: 'lastName', keyword: 'minLength'},
            {path: 'roles.0', keyword: 'maxLength', message: 'user role should be no longer than 4 characters'}
        ]);
    });
})
