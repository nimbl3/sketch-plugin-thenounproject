import MochaJSDelegate from './MochaJSDelegate'

export function fetch(context) {
    var sketchVersion = getSketchVersionNumber()
    var doc = context.document;
    var selection = context.selection
    
    var imagesCollection = []
    var selectedImages = []
    var allImages = []
    function alert(msg, title) {
        var app = NSApplication.sharedApplication();
        app.displayDialog_withTitle(msg, title || "Hear yee, Hear yee");
    }

    function getSketchVersionNumber() {
        const version = NSBundle.mainBundle().objectForInfoDictionaryKey('CFBundleShortVersionString')
        var versionNumber = version.stringByReplacingOccurrencesOfString_withString(".", "") + ""
        while(versionNumber.length != 3) {
          versionNumber += "0"
        }
        return parseInt(versionNumber)
    }

    function getIdentifier(context) {
        var manifestPath = context.scriptPath.stringByDeletingLastPathComponent() + '/manifest.json';
        var manifest = NSData.dataWithContentsOfFile(manifestPath);
        var data = NSJSONSerialization.JSONObjectWithData_options_error(manifest, 0, null);
        return String(data.identifier).toString();
    }

    function askForIcons() {
        var userInput = doc.askForUserInput_initialValue("Please, input your searches", "");
        if (userInput !== null) {
            fetchThatIcon(userInput);
        } else {
            askForIcons();
       }
    }

    function fetchThatIcon(url) {
        var apiURL      = NSURL.URLWithString('https://thenounproject.com/search/json/icon/?q=' + url + '&page=1&limit=25');
        var request     = NSURLRequest.requestWithURL(apiURL);
        var response    = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, null, null);

        var responseString = NSString.alloc().initWithData_encoding(response, NSUTF8StringEncoding);
        allImages = iconUrls(JSON.parse(responseString))
        allImages.length > 0 ? showSelectableImages() : alert("Not found", "Error")
    }

    function iconUrls(response) {
        var imagesString = [];
        
        for (var i = 0; i < response['icons'].length; i++) {
          var iconUrlString = response['icons'][i]['preview_url'];
          imagesString.push(iconUrlString) 
        }
        
        return imagesString;
    }

    function insertToSketch(imageData) {
        allLayers = doc.currentPage().layers()
        // imagesCollection = loadSelectedImages(selection.count())
        for (var i = 0; i < selection.count(); i++) {
          layer = selection[i]
          if (layer.class() == MSShapeGroup) {
            fill = layer.style().fills().firstObject()
            fill.setFillType(4)
    
            if (sketchVersion > 370) {
              image = MSImageData.alloc().initWithImage(imageData)
              fill.setImage(image)
            } else if (sketchVersion < 350) {
              fill.setPatternImage_collection(imageData, fill.documentData().images())
            } else {
              fill.setPatternImage(imageData)
            }
            fill.setPatternFillType(1)
          }
        }
    }

    function loadSelectedImages(layersAmount) {
        numberOfImages = selectedImages.length
        for (var i = 0; i < layersAmount; i++) {
            r = Math.floor(Math.random() * numberOfImages)
            imageUrlString = selectedImages[r]
            newImage = NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString))
            imagesCollection.push(newImage)
        }
        return imagesCollection
    }

    function showSelectableImages() {
        // Show images

        // Main window
        var title = "Nimbl3 nounproject by Po & Ah";
        var identifier = getIdentifier(context);
        var threadDictionary = NSThread.mainThread().threadDictionary();

        if (threadDictionary[identifier]) {
            return;
        }

        var frame = NSMakeRect(0, 0, 300, 350);

        var panel = NSPanel.alloc().init();
        panel.setTitle(title);
        panel.setTitlebarAppearsTransparent(true);

        panel.standardWindowButton(NSWindowCloseButton).setHidden(false);
        panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
        panel.standardWindowButton(NSWindowZoomButton).setHidden(true);

        panel.setFrame_display(frame, false);
        panel.setStyleMask(NSTexturedBackgroundWindowMask | NSTitledWindowMask | NSClosableWindowMask);
        panel.setBackgroundColor(NSColor.whiteColor());
        
        threadDictionary[identifier] = panel;
        COScript.currentCOScript().setShouldKeepAround(true);

        var contentView = panel.contentView();
        var collectionView = NSCollectionView.alloc().initWithFrame(NSMakeRect(0, 0, frame.size.width, frame.size.height));
        for (var i = 0; i < allImages.length; i++) {
            var row = parseInt(i / 5)
            var column = i % 5
            var imageView = NSImageView.alloc().initWithFrame(NSMakeRect(60 * row, 60 * column, 50, 50))
            var imageUrlString = allImages[i]
            imageView.setImage(NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString)))

            var gestureClass = new MochaJSDelegate()
            gestureClass.setHandlerForSelector("gestureRecognizerShouldBegin:", function(gestureRecognizer) {
                insertToSketch(gestureRecognizer.view().image())
                return false
            })
            var gesture = gestureClass.getClassInstance()
            var clickGesture = NSClickGestureRecognizer.alloc().initWithTarget_action(nil, "selectedImageView:")
            clickGesture.setNumberOfClicksRequired(1)
            clickGesture.setDelegate(gesture)
            imageView.addGestureRecognizer(clickGesture)
            contentView.addSubview(imageView);
        }
                
        //Flow layout
        var flowLayout = NSCollectionViewFlowLayout.alloc().init()
        flowLayout.setItemSize(NSMakeSize(80, 80))
        flowLayout.setMinimumLineSpacing(5.0)
        flowLayout.setMinimumInteritemSpacing(5.0)
        
        collectionView.setBackgroundColor(NSColor.whiteColor())
        collectionView.setCollectionViewLayout(flowLayout);

        // var itemNib = NSNib.alloc().initWithNibNamed_bundle("Item", null)
        // collectionView.registerNib_forItemWithIdentifier(itemNib, "CollectionViewItem")
        
        //datasource & delegate
        //var delegate = new MochaJSDelegate()
        var dataSourceClass = new MochaJSDelegate({
            "collectionView:itemForRepresentedObjectAtIndexPath:" : (function(collectionView, indexPath) {
                debugger
                var collectionViewItem = NSCollectionViewItem.alloc().init()
                var imageUrlString = allImages[0]
                collectionViewItem.imageView.setImage(NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString)))
                return collectionViewItem
            }),
            "collectionView:numberOfItemsInSection:" : (function(collectionView, section) {
                return 5
            }) 
        })
        var dataSource = dataSourceClass.getClassInstance()

        // collectionView.setDelegate(delegate)
        collectionView.setDataSource(dataSource)
        // collectionView.reloadData()

        contentView.setWantsLayer(true);
        var contentViewLayer = contentView.layer()
        contentViewLayer.setFrame( contentView.frame() );
        contentViewLayer.setMasksToBounds(true);

        //contentView.addSubview(imageView);
        
        var closeButton = panel.standardWindowButton(NSWindowCloseButton)
        closeButton.setCOSJSTargetFunction(function(sender) {
            COScript.currentCOScript().setShouldKeepAround(false);
            threadDictionary.removeObjectForKey(identifier);
            panel.close();
        });
        closeButton.setAction("callAction:");

        panel.becomeKeyWindow();
        panel.setLevel(NSFloatingWindowLevel);
        panel.center();
        panel.makeKeyAndOrderFront(null);
    }

    function activate() {
        if (selection.count() == 0) {
            alert('Please select a shape to fill the favicon into.', 'Destination shape');
        } else {
            askForIcons();
        }
    }
    
    activate();
}


//-------------------------------------------------------------------------------------------------------------


// GET GPLAY ICON BY NAME OF APP


// function getGplayAppicon(context) {
//   var doc = context.document;
//   var selection = context.selection

//     function alert(msg, title) {
//         var app = [NSApplication sharedApplication];
//         [app displayDialog:msg withTitle:title || "Error"];
//     }

//     function getGplayiconModal() {

//         var userInput = [doc askForUserInput:"Enter any Android app's name (i.e. Facebook)):" initialValue:""];

//         if (userInput !== null) {


//             if (userInput !== null) {

//                 fetchThatGplayicon(userInput);
//             }
//             else {
//                  alert('error', 'Destination shape');
//             }
//         }
//     }

//     function fetchThatGplayicon(appName) {
//         var apiURL      = [NSURL URLWithString:'https://api.import.io/store/data/8dda5db7-deee-44a7-90af-9a49b603b82b/_query?input/webpage/url=https%3A%2F%2Fplay.google.com%2Fstore%2Fsearch%3Fq%3D'+ appName +'%26c%3Dapps&_user=cdb830ea-85cb-4488-8ccd-cd9c6e7a9488&_apikey=cdb830ea85cb44888ccdcd9c6e7a94888e57b45cbdfd7aa6287207d1b2bd54e77f98b99b9d4b9fced1f5e4b1fb7784c7528712988270767e8f642719bcce6a21759beb8d77971dd2f378ac375acfc95c'];
//         var request     = [NSURLRequest requestWithURL:apiURL];
//         var response    = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, null, null);

//         var json = [NSJSONSerialization JSONObjectWithData:response options:null error:null];

//         var imgUrlString = json.results[0].image_icon;
//         var imgURL      = [NSURL URLWithString:imgUrlString];
//         var imgRequest     = [NSURLRequest requestWithURL:imgURL];
//         var img = NSURLConnection.sendSynchronousRequest_returningResponse_error(imgRequest, null, null);

//         var GplayiconImage = [[NSImage alloc] initWithData:img];
// 	    var GplayiconImageData = [[MSImageData alloc] initWithImage:GplayiconImage convertColorSpace:false];
//         var allLayers = [[doc currentPage] layers];
//         for (var i = 0; i < [selection count]; i++) {
//             var layer = selection[i];
//             if ([layer class] == MSShapeGroup) {
//                 fill = layer.style().fills().firstObject();
//                 coll = fill.documentData().images();
//                 //[fill setPatternImage:GplayiconImage collection:coll];
//                 fill.setFillType(4);         // Pattern fillType
//                 fill.setPatternFillType(1);
//                 fill.setIsEnabled(true);
//                 [fill setImage:GplayiconImageData];
//             }
//         }

//     }



//     function activate() {
//         log(selection[0].frame());
//         if ([selection count] == 0) {
//             alert('Please select a shape to fill the Google Play app icon into.', 'Destination shape');
//         }
//         else {
//             getGplayiconModal();
//         }
//     }

//     activate();

// };
