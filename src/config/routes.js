const ROUTES = {
    PRODUCT: {
      ADD: '/product-add',
      UPDATE: '/product-edit/:id',
      GET: '/product/:id',
      GET_ALL: '/product',
      DELETE: '/product/:id',
    },
    USER: {
      REGISTER: '/user/register',
      LOGIN: '/user/login',
      PROFILE: '/user/profile/:id',
    },
    
    // Add other resource routes here as needed
  };
  
  module.exports = ROUTES;
  