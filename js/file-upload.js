window.rwmb = window.rwmb || {};

jQuery( function ( $ )
{
	'use strict';

	var views = rwmb.views = rwmb.views || {},
		MediaField = views.MediaField,
		MediaItem = views.MediaItem,
		MediaList = views.MediaList,
		FileUploadField, UploadButton;

	FileUploadField = views.FileUploadField = MediaField.extend( {
		createAddButton: function ()
		{
			this.addButton = new UploadButton( { collection: this.collection, props: this.props } );
		}
	} );

	UploadButton = views.UploadButton = Backbone.View.extend( {
		className: 'rwmb-upload-area',
		tagName  : 'div',
		template: wp.template( 'rwmb-upload-area' ),
		render   : function ()
		{
			var data = {
				browseID: _.uniqueId( 'rwmb-upload-browser-'),
				browseLabel: i18nRwmbMedia.add
			};
			this.$el.html( this.template( data ) );
			return this;
		},

		initialize: function ( options )
		{
			this.el.id = _.uniqueId( 'rwmb-upload-area-');
			this.render();

			//Areas
			this.$dropzone = this.$el;
			this.$browser  = this.$('.rwmb-browse-button');

			this.supports = {
				upload: wp.Uploader.browser.supported
			};

			this.supported = this.supports.upload;

			if ( this.supported ) {
				this.initUploader();
			}
		},
		//Initializes plupload
		//Uses code from wp.Uploader
		initUploader: function ()
		{
			var isIE = navigator.userAgent.indexOf('Trident/') != -1 || navigator.userAgent.indexOf('MSIE ') != -1,
				self = this;
				this.plupload = $.extend( true, {
					multipart_params: {},
					multipart: true,
					urlstream_upload: true,
				 	drop_element: this.$dropzone[0],
				 	browse_button: this.$browser[0] }, wp.Uploader.defaults );

			// Make sure flash sends cookies (seems in IE it does without switching to urlstream mode)
			if ( ! isIE && 'flash' === plupload.predictRuntime( this.plupload ) &&
				( ! this.plupload.required_features || ! this.plupload.required_features.hasOwnProperty( 'send_binary_string' ) ) ) {

				this.plupload.required_features = this.plupload.required_features || {};
				this.plupload.required_features.send_binary_string = true;
			}

			// Initialize the plupload instance.
			this.uploader = new plupload.Uploader( this.plupload );
			this.uploader.init();

			this.uploader.bind( 'FilesAdded', function( up, files ) {
				_.each( files, function( file ) {
					var attributes, image;

					// Ignore failed uploads.
					if ( plupload.FAILED === file.status ) {
						return;
					}

					// Generate attributes for a new `Attachment` model.
					attributes = _.extend({
						file:        file,
						uploading:   true,
						date:        new Date(),
						filename:    file.name,
						menuOrder:   0,
						uploadedTo:  wp.media.model.settings.post.id,
						icon:        i18nRwmbMedia.loading_url
					}, _.pick( file, 'loaded', 'size', 'percent' ) );

					// Handle early mime type scanning for images.
					image = /(?:jpe?g|png|gif)$/i.exec( file.name );

					// For images set the model's type and subtype attributes.
					if ( image )
					{
						attributes.type = 'image';

						// `jpeg`, `png` and `gif` are valid subtypes.
						// `jpg` is not, so map it to `jpeg`.
						attributes.subtype = ( 'jpg' === image[0] ) ? 'jpeg' : image[0];
					}

					// Create a model for the attachment, and add it to the Upload queue collection
					// so listeners to the upload queue can track and display upload progress.
					file.attachment = wp.media.model.Attachment.create( attributes );
					wp.Uploader.queue.add( file.attachment );
					self.collection.add( file.attachment );
				});

				up.refresh();
				up.start();
			});

			this.uploader.bind( 'UploadProgress', function( up, file ) {
				file.attachment.set( _.pick( file, 'loaded', 'percent' ) );
			});

			this.uploader.bind( 'FileUploaded', function( up, file, response ) {
				var complete;

				try {
					response = JSON.parse( response.response );
				} catch ( e ) {
					return error( pluploadL10n.default_error, e, file );
				}

				if ( ! _.isObject( response ) || _.isUndefined( response.success ) )
					return error( pluploadL10n.default_error, null, file );
				else if ( ! response.success )
					return error( response.data && response.data.message, response.data, file );

				_.each(['file','loaded','size','percent'], function( key ) {
					file.attachment.unset( key );
				});

				file.attachment.set( _.extend( response.data, { uploading: false }) );
				wp.media.model.Attachment.get( response.data.id, file.attachment );

				complete = wp.Uploader.queue.all( function( attachment ) {
					return ! attachment.get('uploading');
				});

				if ( complete )
					wp.Uploader.queue.reset();
			});

			this.uploader.bind( 'Error', function ( up, error )
			{
				if( error.file.attachment )
					error.file.attachment.destroy();
			} );
		}
	} );


	/**
	 * Initialize image fields
	 * @return void
	 */
	function init()
	{
		new FileUploadField( { input: this, el: $( this ).siblings( 'div.rwmb-media-view' ) } );
	}
	$( ':input.rwmb-file_upload' ).each( init );
	$( '.rwmb-input' )
		.on( 'clone', ':input.rwmb-file_upload', init )
} );