App({
  onPageNotFound(){
    // An old experience QR may still point at a removed or mistyped route.
    wx.reLaunch({url:'/pages/index/index'});
  }
});
