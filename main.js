window.start_app = (function() {

  let control = {
    /*
      Width in pixels of the image used for  processing
      Smaller images can reduce noise

      160 works well
    */
    w: 160,

    threshold: 100, // rgba 0-255

    /*
      Capture interval in ms
      
      100: looks best but doesn't catch slow movements

      500: stuttering but catches slow movements
    */
    interval: 100, // time ms

    min_pts: 100, // minimum_length

    /*
      0 - Infinity
      Inifinity = perfectly convex
      80 = mostly convex
      20 = concave
    */
    concavity: Infinity, 

    /*
      Amount of each color to use in calculation
      Can isolate skin tones, environment, etc
      Lower values reduce noise
    */
    r: 0.9,
    g: 0.8,
    b: 0.3,
  };

  // Just preparing HTML
  let video = document.getElementById('video'); // doesn't have to be webcam
  let canvas = document.getElementById('canvas');
  let diff = document.getElementById('diff');

  // Fit elements to window
  let w = window.innerWidth;
  let h = window.innerHeight;

  let scale_down = control.w / w;
  let scale_up = w / control.w;

  let w_diff = Math.floor( w * scale_down );
  let h_diff = Math.floor( h * scale_down );

  video.width = w;
  video.height = h;
  canvas.width = w;
  canvas.height = h;

  diff.width = w_diff;
  diff.height = h_diff;

  // Get interface for rendering
  let ctx_difference = diff.getContext('2d');
  let ctx_normal = canvas.getContext('2d');

  let motion_pts = [];
  let convex_hull = [];

  let interval = null;

  navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { 
          width: w, 
          height: h
      }
    })

    .then( requested_stream => {

      stream = requested_stream;

      video.srcObject = stream;

      interval = setInterval( capture , control.interval);
    })

    .catch( error => {
      console.log(error);
    });

  let num_runs = false;

  function capture () {
    ctx_difference.globalCompositeOperation = 'difference';
    ctx_difference.drawImage(video, 0, 0, w_diff, h_diff);

    let image = ctx_difference.getImageData(0, 0, w_diff, h_diff);

    if (num_runs) {
      let diff = process_image(image);

      // ctx_normal.putImageData(image, 0, 0);
      ctx_normal.clearRect(0, 0, w, h);
      // draw convex hull
      let empty = (motion_pts.length < control.min_pts);

      if (!empty) {
        convex_hull = hull(motion_pts, control.concavity);
        console.log(convex_hull.length);
      }
      ctx_normal.beginPath();

      ctx_normal.strokeStyle = "red";

      ctx_normal.moveTo(convex_hull[0][0], convex_hull[0][1]);

      for (let i = 1; i < convex_hull.length; i++) {
        ctx_normal.lineTo(convex_hull[i][0], convex_hull[i][1]);
      }
      ctx_normal.stroke();

      motion_pts.length = 0;
    }
    num_runs = true;

    // draw current capture normally over diff, ready for next time
    ctx_difference.globalCompositeOperation = 'source-over';
    ctx_difference.drawImage(video, 0, 0, w_diff, h_diff);
  }

  function process_image (image) {
    /*
      rgba = array of color values from 0-255 [ r, g, b, a ... ]
      p = pixel index, every 4 values is 1 pixel
      i = actual index
      threshold = color separation needed for movement, 0-255
    */
    let rgba = image.data;
    let p = 0;
    let i = 0;

    for (i = 0; i < rgba.length; i += 4, p++) {
    
      let difference = (rgba[i] * control.r) + (rgba[i + 1] * control.g) + (rgba[i + 2] * control.b);
      
      let normalized = Math.min(255, difference * (255 / control.threshold));
      
      rgba[i] = 0;
      rgba[i + 1] = normalized;
      rgba[i + 2] = 0;

      // add pt to array for creating hull
      if (difference > control.threshold) {
        motion_pts.push(
          [
            (p % w_diff) * scale_up,
            Math.floor(p / w_diff) * scale_up
          ]
        );
      }
    }
    // --- end func
  }

});
