import MochaJSDelegate from './MochaJSDelegate';

export function fetch(context) {
  var sketchVersion = getSketchVersionNumber();
  var doc = context.document;
  var selection = context.selection;

  var imagesCollection = [];
  var selectedImages = [];
  var allImages = [];

  function alert(msg, title) {
    var app = NSApplication.sharedApplication();
    app.displayDialog_withTitle(msg, title || ' ');
  }

  function getSketchVersionNumber() {
    const version = NSBundle.mainBundle().objectForInfoDictionaryKey('CFBundleShortVersionString');
    var versionNumber = version.stringByReplacingOccurrencesOfString_withString('.', '') + '';
    while (versionNumber.length !== 3) {
      versionNumber += '0';
    }
    return parseInt(versionNumber);
  }

  function getIdentifier(context) {
    var manifestPath = context.scriptPath.stringByDeletingLastPathComponent() + '/manifest.json';
    var manifest = NSData.dataWithContentsOfFile(manifestPath);
    var data = NSJSONSerialization.JSONObjectWithData_options_error(manifest, 0, null);
    return String(data.identifier).toString();
  }

  function askForIcons() {
    var userInput = doc.askForUserInput_initialValue('Icons for everything', '');
    if (userInput !== null) {
      fetchThatIcon(userInput);
    } else {
      askForIcons();
    }
  }

  function fetchThatIcon(url) {
    var apiURL = NSURL.URLWithString('https://thenounproject.com/search/json/icon/?q=' + url + '&page=1&limit=25');
    var request = NSURLRequest.requestWithURL(apiURL);
    var response = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, null, null);

    var responseString = NSString.alloc().initWithData_encoding(response, NSUTF8StringEncoding);
    allImages = iconUrls(JSON.parse(responseString));
    allImages.length > 0 ? showSelectableImages() : alert('Not found', 'Error');
  }

  function iconUrls(response) {
    var imagesString = [];

    for (var i = 0; i < response['icons'].length; i++) {
      var iconUrlString = response['icons'][i]['preview_url'];
      imagesString.push(iconUrlString);
    }

    return imagesString;
  }

  function insertToSketch() {
    allLayers = doc.currentPage().layers();
    imagesCollection = loadSelectedImages(selection.count());
    for (var i = 0; i < selection.count(); i++) {
      layer = selection[i];
      if (layer.class() === MSShapeGroup) {
        imageData = imagesCollection[i];
        fill = layer.style().fills().firstObject();
        fill.setFillType(4);

        if (sketchVersion > 370) {
          image = MSImageData.alloc().initWithImage(imageData);
          fill.setImage(image);
        } else if (sketchVersion < 350) {
          fill.setPatternImage_collection(imageData, fill.documentData().images());
        } else {
          fill.setPatternImage(imageData);
        }
        fill.setPatternFillType(1);
      }
    }
  }

  function loadSelectedImages(layersAmount) {
    numberOfImages = selectedImages.length;
    for (var i = 0; i < layersAmount; i++) {
      r = Math.floor(Math.random() * numberOfImages);
      imageUrlString = selectedImages[r];
      newImage = NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString));
      imagesCollection.push(newImage);
    }
    return imagesCollection;
  }

  function showSelectableImages() {
    // Show images

    // Main window
    var title = 'Nimbl3 nounproject by Po & Ah';
    var identifier = getIdentifier(context);
    var threadDictionary = NSThread.mainThread().threadDictionary();

    if (threadDictionary[identifier]) {
      return;
    }

    var frame = NSMakeRect(0, 0, 400, 400);

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
    var imageView = NSImageView.alloc().initWithFrame(NSMakeRect(0, 0, frame.size.width, frame.size.height));
    var imageUrlString = allImages[0];
    imageView.setImage(NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString)));

    // Flow layout
    var flowLayout = NSCollectionViewFlowLayout.alloc().init();
    flowLayout.setItemSize(NSMakeSize(80, 80));
    flowLayout.setMinimumLineSpacing(5.0);
    flowLayout.setMinimumInteritemSpacing(5.0);

    collectionView.setBackgroundColor(NSColor.whiteColor());
    collectionView.setCollectionViewLayout(flowLayout);

    // var itemNib = NSNib.alloc().initWithNibNamed_bundle("Item", null)
    // collectionView.registerNib_forItemWithIdentifier(itemNib, "CollectionViewItem")

    // datasource & delegate
    // var delegate = new MochaJSDelegate()
    var dataSourceClass = new MochaJSDelegate({
      'collectionView:itemForRepresentedObjectAtIndexPath:': function(collectionView, indexPath) {
        var collectionViewItem = NSCollectionViewItem.alloc().init();
        var imageUrlString = allImages[0];
        collectionViewItem.imageView.setImage(NSImage.alloc().initWithContentsOfURL(NSURL.URLWithString(imageUrlString)));
        return collectionViewItem;
      },
      'collectionView:numberOfItemsInSection:': function(collectionView, section) {
        return 5;
      }
    });
    var dataSource = dataSourceClass.getClassInstance();

    // collectionView.setDelegate(delegate)
    collectionView.setDataSource(dataSource);
    // collectionView.reloadData()

    contentView.setWantsLayer(true);
    var contentViewLayer = contentView.layer();
    contentViewLayer.setFrame(contentView.frame());
    contentViewLayer.setMasksToBounds(true);

    contentView.addSubview(imageView);

    var closeButton = panel.standardWindowButton(NSWindowCloseButton);
    closeButton.setCOSJSTargetFunction(function(sender) {
      COScript.currentCOScript().setShouldKeepAround(false);
      threadDictionary.removeObjectForKey(identifier);
      panel.close();
    });
    closeButton.setAction('callAction:');

    panel.becomeKeyWindow();
    panel.setLevel(NSFloatingWindowLevel);
    panel.center();
    panel.makeKeyAndOrderFront(null);
  }

  function activate() {
    if (selection.count() === 0) {
      alert('Please select a shape to fill the favicon into.', 'Destination shape');
    } else {
      askForIcons();
    }
  }

  activate();
}
