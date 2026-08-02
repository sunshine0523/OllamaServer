import React, {useEffect, useState} from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
    NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppTheme} from '../theme/ThemeContext';
import {useTranslation} from 'react-i18next';

interface Props {
    visible: boolean;
    text: string;
    onClose: () => void;
}

/**
 * "选择文本"弹窗：显示消息全文，用户可拖动选择部分内容后复制；
 * 未选择任何内容时点复制则复制全文。
 */
const SelectTextModal = ({visible, text, onClose}: Props) => {
    const theme = useAppTheme();
    const {t} = useTranslation();
    const [value, setValue] = useState(text);
    const [selection, setSelection] = useState({start: 0, end: 0});

    useEffect(() => {
        if (visible) {
            setValue(text);
            setSelection({start: 0, end: 0});
        }
    }, [visible, text]);

    const selectAll = () => {
        setSelection({start: 0, end: value.length});
    };

    const copySelected = () => {
        const selected =
            selection.start !== selection.end
                ? value.slice(selection.start, selection.end)
                : value;
        try {
            NativeModules.ClipboardModule.copyToClipboard(selected);
            ToastAndroid.show(t('copiedToClipboard'), ToastAndroid.SHORT);
        } catch (e) {
            // ignore
        }
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.colors.surface,
                            shadowColor: theme.colors.scrim,
                        },
                    ]}>
                    <View style={styles.header}>
                        <Icon name="text-fields" size={20} color={theme.colors.primary}/>
                        <Text style={[styles.title, {color: theme.colors.onSurface}]}>
                            {t('selectText')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="close" size={20} color={theme.colors.onSurfaceVariant}/>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
                        {t('selectHint')}
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.colors.surfaceContainerLow,
                                color: theme.colors.onSurface,
                            },
                        ]}
                        multiline
                        value={value}
                        // 只读：忽略一切输入/删除修改（editable=false 在 Android 上会同时禁用文本选择，
                        // 因此保持可编辑状态，但用受控 value 保证内容不可变）
                        onChangeText={() => {
                            // ignore edits
                        }}
                        showSoftInputOnFocus={false}
                        selection={selection}
                        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                        autoFocus
                        textAlignVertical="top"
                    />
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, {backgroundColor: theme.colors.secondaryContainer}]}
                            onPress={selectAll}>
                            <Text style={[styles.btnText, {color: theme.colors.onSecondaryContainer}]}>
                                {t('selectAll')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, {backgroundColor: theme.colors.primary}]}
                            onPress={copySelected}>
                            <Text style={[styles.btnText, {color: theme.colors.onPrimary}]}>
                                {t('copySelected')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        elevation: 8,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: {width: 0, height: 4},
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    closeBtn: {
        padding: 4,
    },
    hint: {
        fontSize: 12,
        marginTop: 8,
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        padding: 12,
        minHeight: 140,
        maxHeight: 280,
        fontSize: 15,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 14,
    },
    btn: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 20,
    },
    btnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SelectTextModal;
