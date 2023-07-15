import { h } from "vue";

// Admin AuthUser
export default {
	// Icons
	// props: ["light", "dark"],
	props: ["href", "text", "active"],
	methods: {
		admin() {
			console.log("admin page");
		}
	},
	computed: {
		userPhotoURL() {
			return this.$parent.dataStore.userInfo.photoURL;
		},

		userInfo() {
			return this.$parent.dataStore.userInfo;
		},
		userAuthenticate() {
			return this.$parent.dataStore.userAuthenticate;
		}
	},
	// <a href="#"><span class="img"></span> <span>label</span></a>
	render() {
		let attrLink = {
			// href: this.href,
			title: this.text,
			onClick: () => {
				if (this.active != "current") {
					window.location.href = this.href;
				}
			}
		};
		// if (this.active == "current") {
		// 	attrLink.href = "#";
		// }
		if (this.userAuthenticate) {
			attrLink.class = "active";
		}
		let attrImg = {
			class: ["img"]
		};
		if (this.userPhotoURL) {
			attrImg.class.push("withImage");
			attrImg.style = "background-image: url('" + this.userPhotoURL + "')";
		}
		let label = {
			displayName: this.text
		};
		if (this.userAuthenticate) {
			if (this.userInfo.displayName) {
				label.displayName = this.userInfo.displayName;
			} else {
				label.displayName = this.userInfo.email;
			}
		}

		// return h("a", attr, [h("span", {}, this.text)]);
		return h("a", attrLink, [
			h("span", attrImg),
			h("span", { class: "label" }, label.displayName)
		]);
	}
};
